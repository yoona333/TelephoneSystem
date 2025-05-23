const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 180000, // 增加到3分钟 
  pingInterval: 25000, // 每25秒发送一次ping
  transports: ['polling', 'websocket'], // 先使用 polling，再尝试 websocket
  allowUpgrades: true, // 允许传输方式升级
  perMessageDeflate: true, // 启用消息压缩
  upgradeTimeout: 30000, // 增加传输升级超时时间
  maxHttpBufferSize: 1e8, // 增加最大buffer大小
  connectTimeout: 45000 // 增加连接超时时间
});

// 启用CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// 添加预检请求处理
app.options('*', cors());

app.use(express.json());

// 添加缓存控制中间件，防止浏览器缓存静态文件
app.use((req, res, next) => {
  if (req.url === '/' || req.url.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// 设置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 存储活跃通话
const activeCalls = new Map();

// 通话历史文件路径
const CALL_HISTORY_FILE = path.join(__dirname, 'call_history.json');

// 在适当位置添加这段代码，用于持久化callRecords
const CALL_RECORDS_FILE = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'call_records.json')  // Render 支持的临时目录
  : path.join(__dirname, 'call_records.json');

// 加载通话历史
function loadCallHistory() {
  try {
    if (fs.existsSync(CALL_HISTORY_FILE)) {
      const data = fs.readFileSync(CALL_HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载通话历史失败:', error);
  }
  return [];
}

// 保存通话历史
function saveCallHistory() {
  try {
    fs.writeFileSync(CALL_HISTORY_FILE, JSON.stringify(callHistory, null, 2), 'utf8');
    console.log(`保存了 ${callHistory.length} 条通话记录`);
  } catch (error) {
    console.error('保存通话历史失败:', error);
  }
}

// 初始化通话历史
const callHistory = loadCallHistory();

// 添加一个函数来检查是否已存在相同的通话记录
function isDuplicateCall(phoneNumber) {
  // 检查最近30秒内是否有相同号码的通话
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  return callHistory.some(call => 
    call.phoneNumber === phoneNumber && 
    new Date(call.startTime) > thirtySecondsAgo
  );
}

// 添加一个活跃通话检查函数
function hasActiveCallWithNumber(phoneNumber) {
  // 检查是否已经有该号码的活跃通话
  for (const [_, call] of activeCalls.entries()) {
    if (call.phoneNumber === phoneNumber && 
        (call.status === 'ringing' || call.status === 'active')) {
      return true;
    }
  }
  return false;
}

// 在服务器端添加去重逻辑
// 在文件顶部添加
const sentEvents = new Set(); // 用于跟踪已发送的事件

// 修改发送事件的逻辑
function broadcastCallStatus(data) {
  // 创建事件唯一标识
  const eventId = `${data.callId}-${data.status}-${Date.now()}`;
  
  // 检查是否已经发送过类似事件（短时间内相同callId和status的事件）
  const similarEventKey = `${data.callId}-${data.status}`;
  for (const key of sentEvents) {
    if (key.startsWith(similarEventKey) && Date.now() - parseInt(key.split('-')[2]) < 3000) {
      console.log(`跳过重复广播: ${similarEventKey}`);
      return; // 短时间内已经发送过类似事件，跳过
    }
  }
  
  // 记录事件并清理过期事件
  sentEvents.add(eventId);
  setTimeout(() => sentEvents.delete(eventId), 5000); // 5秒后自动清理
  
  // 广播事件
  console.log(`广播通话状态: ${JSON.stringify(data)}`);
  io.emit('call_status', data);
}

// 加载通话记录
function loadCallRecords() {
  try {
    if (fs.existsSync(CALL_RECORDS_FILE)) {
      const data = fs.readFileSync(CALL_RECORDS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载通话记录失败:', error);
  }
  return [];
}

// 保存通话记录
function saveCallRecords() {
  try {
    const recordsDir = path.dirname(CALL_RECORDS_FILE);
    
    // 确保目录存在
    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }
    
    fs.writeFileSync(CALL_RECORDS_FILE, JSON.stringify(callRecords, null, 2), 'utf8');
    console.log(`保存了 ${callRecords.length} 条通话记录`);
  } catch (error) {
    console.error('保存通话记录失败:', error);
    console.error('错误详情:', error.message);
    // 在生产环境中尝试写入临时目录
    if (process.env.NODE_ENV === 'production') {
      try {
        const tempFile = path.join('/tmp', 'call_records.json');
        fs.writeFileSync(tempFile, JSON.stringify(callRecords, null, 2), 'utf8');
        console.log(`保存到临时目录成功: ${tempFile}`);
      } catch (tempError) {
        console.error('临时保存也失败:', tempError);
      }
    }
  }
}

// 初始化通话记录
const callRecords = loadCallRecords();

// 用于格式化时间的函数
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 修改添加通话记录函数
function addCallRecord(phoneNumber, status, duration = null, updateOnly = false) {
  // 详细日志
  console.log(`\n=======================================`);
  console.log(`添加通话记录: ${phoneNumber} | ${status} | ${duration || 'N/A'} | updateOnly: ${updateOnly}`);
  
  // 查找是否有现有记录，缩短时间窗口到2分钟，避免历史记录匹配太久远的记录
  const existingIndex = callRecords.findIndex(record => 
    record.phoneNumber === phoneNumber &&
    Math.abs(record.timestamp - Date.now()) < 120000 // 2分钟内的记录
  );
  
  let resultRecord = null;
  
  // 如果找到现有记录并且要求更新模式或者状态为已挂断
  if (existingIndex !== -1 && (updateOnly || status === "已挂断")) {
    console.log(`更新现有记录 index ${existingIndex}: ${phoneNumber} | ${status}`);
    
    // 更新现有记录
    const updatedRecord = {
      ...callRecords[existingIndex],
      status: status,
      timestamp: Date.now(),
      time: formatTime(Date.now())
    };
    
    // 如果有时长，也更新时长
    if (duration !== null) {
      updatedRecord.duration = duration;
    }
    
    // 替换记录
    callRecords[existingIndex] = updatedRecord;
    resultRecord = updatedRecord;
    
    // 保存到文件
    saveCallRecords();
    
    // 广播更新
    io.emit('call_record_update', updatedRecord);
    
    console.log(`记录已更新: ${phoneNumber} | ${status}`);
  }
  // 如果是更新模式但找不到现有记录，则跳过
  else if (updateOnly && existingIndex === -1) {
    console.log(`指定为仅更新模式但找不到现有记录，跳过创建`);
    console.log(`=======================================\n`);
    return null;
  }
  // 创建新记录
  else {
    // 严格检查重复记录，缩短时间窗口，避免太多重复
    const recentTime = Date.now() - 30000; // 30秒前
    const hasDuplicate = callRecords.some(record => 
      record.phoneNumber === phoneNumber && 
      (record.status === status || (status === "已挂断" && record.status === "已接通")) &&
      record.timestamp > recentTime
    );
    
    if (hasDuplicate) {
      console.log(`==================`);
      console.log(`跳过重复记录: ${phoneNumber} | ${status}`);
      console.log(`==================`);
      return null;
    }
    
    // 创建记录
    const record = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`, // 使ID更加唯一
      phoneNumber,
      timestamp: Date.now(),
      time: formatTime(Date.now()),
      status,
      duration
    };
    
    // 添加到数组开头
    callRecords.unshift(record);
    resultRecord = record;
    
    // 如果记录超过1000条，删除旧记录
    if (callRecords.length > 1000) {
      callRecords.splice(1000);
    }
    
    // 打印到控制台
    const durationText = duration ? ` (${duration.toFixed(1)}秒)` : '';
    console.log(`========================`);
    console.log(`新增通话记录: ${phoneNumber} | ${status}${durationText}`);
    console.log(`========================`);
    
    // 保存记录到文件
    saveCallRecords();
    
    // 广播给客户端
    io.emit('call_record_update', record);
  }
  
  // 在WebSocket广播之外，发送一个特殊的记录更新事件，帮助手机客户端同步
  io.emit('phone_record_update', {
    type: 'record_update',
    timestamp: Date.now(),
    record: resultRecord,
    allRecords: getMergedRecords()
  });
  
  // 保存后验证
  console.log(`当前记录数量: ${callRecords.length}`);
  console.log(`=======================================\n`);
  
  return resultRecord;
}

// 路由
app.get('/api/status', (req, res) => {
  // 添加详细日志，便于调试
  console.log('收到状态检查请求:', req.ip, new Date().toISOString());
  
  // 返回更详细的服务器状态信息
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    serverTime: new Date().toISOString(),
    connections: io.engine.clientsCount,
    activeCalls: activeCalls.size,
    transport: req.get('X-Transport') || 'unknown'
  });
});

// 获取所有活跃通话
app.get('/api/calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([id, call]) => ({
    callId: id,
    phoneNumber: call.phoneNumber,
    status: call.status,
    startTime: call.startTime,
    answerTime: call.answerTime || null,
    duration: call.duration || 0,
    isActive: call.status !== 'ended'
  }));
  
  // 增加一些调试信息
  console.log(`返回 ${calls.length} 个活跃通话`);
  
  res.json(calls);
});

// 获取通话历史
app.get('/api/call-history', (req, res) => {
  // 返回所有通话历史，不限制数量
  res.json(callHistory);
});

// 确保通话历史不会过大
// 可以添加一个定期清理的功能，例如只保留最近30天的记录
function cleanupOldCallHistory() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // 过滤掉30天前的记录
  const oldLength = callHistory.length;
  callHistory = callHistory.filter(call => 
    new Date(call.startTime) > thirtyDaysAgo
  );
  
  if (oldLength !== callHistory.length) {
    console.log(`清理了 ${oldLength - callHistory.length} 条旧通话记录`);
  }
}

// 每天运行一次清理
setInterval(cleanupOldCallHistory, 24 * 60 * 60 * 1000);

// 修改拨打电话API
app.post('/api/call', (req, res) => {
  const { phoneNumber } = req.body;
  
  // 创建新通话ID
  const callId = Date.now().toString();
  console.log(`收到新拨打请求，手机号: ${phoneNumber}, callId: ${callId}`);
  
  // 检查是否有重复拨打（同一号码在短时间内）
  for (const [existingId, existingCall] of activeCalls.entries()) {
    const timeDiff = Date.now() - new Date(existingCall.startTime).getTime();
    if (existingCall.phoneNumber === phoneNumber && timeDiff < 5000) {
      console.log(`检测到重复拨打，复用现有通话: ${existingId}`);
      return res.json({ callId: existingId });
    }
  }
  
  // 创建新的通话对象
  const call = { 
    callId, 
    phoneNumber, 
    status: 'ringing',
    startTime: new Date().toISOString()
  };
  
  // 保存到活跃通话
  activeCalls.set(callId, call);
  
  // 添加到通话历史
  callHistory.push({
    callId,
    phoneNumber,
    status: 'ringing',
    startTime: new Date().toISOString(),
    type: 'outgoing'
  });
  
  // 保存通话历史
  saveCallHistory();
  
  // 添加"已发起"记录
  addCallRecord(phoneNumber, "已发起");
  
  // 广播通话状态，包含command字段
  broadcastCallStatus({ 
    callId, 
    phoneNumber, 
    status: 'ringing',
    command: 'ring'  // 添加ring命令
  });
  
  // 不再设置自动挂断定时器，让通话持续响铃直到用户操作
  console.log('通话将保持响铃状态，直到用户在控制台接听或挂断');
  
  res.json({ callId });
});

// 修改接听逻辑
app.post('/api/answer', (req, res) => {
  const { callId, updateOnly } = req.body;
  console.log(`接听电话请求, callId: ${callId}, updateOnly: ${updateOnly}`);
  
  if (!activeCalls.has(callId)) {
    return res.status(404).json({ error: '通话不存在' });
  }
  
  const call = activeCalls.get(callId);
  
  // 更新通话状态
  call.status = 'active';
  call.answerTime = new Date().toISOString();
  
  // 更新历史记录
  const historyCall = callHistory.find(c => c.callId === callId);
  if (historyCall) {
    historyCall.status = 'active';
    historyCall.answerTime = call.answerTime;
    saveCallHistory();
  }
  
  // 修改广播部分，确保包含command字段
  broadcastCallStatus({ 
    callId, 
    phoneNumber: call.phoneNumber, 
    status: 'active',
    command: 'answer'  // 明确指定answer命令
  });
  
  // 添加"已接通"记录，传入updateOnly参数
  addCallRecord(call.phoneNumber, "已接通", null, updateOnly === true);
  
  res.json({ success: true });
});

// 修改挂断逻辑
app.post('/api/hangup', (req, res) => {
  const { callId, updateOnly } = req.body;
  console.log(`\n======= 挂断电话请求 =======`);
  console.log(`CallID: ${callId}, updateOnly: ${updateOnly}`);
  
  // 即使找不到通话也创建记录（避免状态不同步问题）
  if (!activeCalls.has(callId)) {
    console.log(`警告: 找不到通话ID ${callId}`);
    
    // 尝试在通话历史中查找
    const historyCall = callHistory.find(c => c.callId === callId);
    if (historyCall) {
      console.log(`在历史记录中找到了通话: ${historyCall.phoneNumber}`);
      
      // 添加挂断记录，强制使用updateOnly=true减少重复记录
      addCallRecord(historyCall.phoneNumber, "已挂断", 0, true);
      
      // 发送挂断命令
      broadcastCallStatus({ 
        callId,
        phoneNumber: historyCall.phoneNumber,
        status: 'ended',
        command: 'hangup'  // 明确指定hangup命令
      });
      
      return res.json({ success: true });
    }
    
    return res.status(404).json({ error: '通话不存在' });
  }
  
  const call = activeCalls.get(callId);
  
  // 计算通话时长
  const endTime = new Date();
  const startTime = call.status === 'active' ? new Date(call.answerTime || call.startTime) : new Date(call.startTime);
  const duration = Math.floor((endTime - startTime) / 1000);
  
  // 更新通话记录
  call.status = 'ended';
  call.endTime = endTime.toISOString();
  call.duration = duration;
  
  // 更新历史记录
  const historyCall = callHistory.find(c => c.callId === callId);
  if (historyCall) {
    historyCall.status = 'ended';
    historyCall.endTime = endTime.toISOString();
    historyCall.duration = duration;
    saveCallHistory();
  }
  
  // 广播通话状态，确保包含command字段
  broadcastCallStatus({ 
    callId, 
    status: 'ended',
    duration,
    phoneNumber: call.phoneNumber,
    command: 'hangup'  // 明确指定hangup命令
  });
  
  // 从活跃通话中移除
  activeCalls.delete(callId);
  
  // 添加"已挂断"记录，并确保记录添加成功
  // 强制使用updateOnly=true来避免创建重复记录
  const record = addCallRecord(call.phoneNumber, "已挂断", duration, true);
  console.log("已添加挂断记录:", JSON.stringify(record));
  
  res.json({ success: true });
});

// WebSocket连接
io.on('connection', (socket) => {
  // 添加详细的连接日志
  console.log('===== 新客户端连接 =====');
  console.log('客户端已连接, ID:', socket.id);
  console.log('客户端IP:', socket.handshake.address);
  console.log('客户端传输方式:', socket.conn.transport.name);
  console.log('客户端查询参数:', socket.handshake.query);
  console.log('========================');
  
  // 发送欢迎消息确认连接
  socket.emit('welcome', { 
    message: '连接成功', 
    socketId: socket.id,
    serverTime: new Date().toISOString()
  });
  
  // 每30秒发送一次ping确保连接活跃
  const pingInterval = setInterval(() => {
    if (socket.connected) {
      console.log(`向客户端 ${socket.id} 发送ping`);
      socket.emit('server_ping', { time: new Date().toISOString() });
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
  
  socket.on('pong', (data) => {
    console.log(`收到客户端 ${socket.id} 的pong响应:`, data);
  });
  
  // 添加客户端同步完成事件监听
  socket.on('client_sync_complete', (data) => {
    console.log(`客户端 ${socket.id} 同步完成:`, data);
    
    // 将消息广播给其他客户端，促使它们也进行同步
    socket.broadcast.emit('other_client_synced', {
      clientId: socket.id,
      timestamp: Date.now(),
      message: '其他客户端已同步记录'
    });
  });
  
  socket.on('disconnect', (reason) => {
    console.log('===== 客户端断开连接 =====');
    console.log('客户端已断开连接, ID:', socket.id, '原因:', reason);
    console.log('清理相关资源...');
    clearInterval(pingInterval);
    console.log('===========================');
  });
  
  socket.on('error', (error) => {
    console.log('Socket错误:', error);
  });
  
  socket.on('call_status_update', (data) => {
    console.log('收到客户端状态更新：', data);
    
    // 移除重复检查，确保所有状态都被记录
    if (data.status === 'ringing') {
      addCallRecord(data.phoneNumber, "响铃中");
    } else if (data.status === 'answered' || data.status === 'active') {
      addCallRecord(data.phoneNumber, "已接通");
    } else if (data.status === 'ended') {
      console.log('添加挂断记录:', data.phoneNumber, data.duration);
      addCallRecord(data.phoneNumber, "已挂断", data.duration);
    }
    
    // 广播给客户端
    io.emit('call_status', data);
  });
  
  // 连接后立即发送当前记录信息
  socket.emit('current_records_info', {
    count: callRecords.length,
    lastUpdate: new Date().toISOString()
  });
});

// 修改获取通话记录的API
app.get('/api/call-records', (req, res) => {
  console.log(`返回 ${callRecords.length} 条通话记录`);
  res.json(callRecords);
});

// 添加清空通话历史记录API
app.post('/api/clear-history', (req, res) => {
  console.log('收到清空通话记录请求');
  
  try {
    // 清空记录数组
    callRecords.length = 0;
    
    // 也清空活跃通话
    activeCalls.clear();
    
    // 保存到文件
    saveCallRecords();
    
    // 广播清空事件
    io.emit('records_cleared', { 
      timestamp: Date.now(),
      message: '所有通话记录已清空'
    });
    
    console.log('所有通话记录已清空');
    res.json({ success: true, message: '通话记录已清空' });
  } catch (error) {
    console.error('清空通话记录失败:', error);
    res.status(500).json({ success: false, message: '清空通话记录失败' });
  }
});

// 修复客户端检查记录逻辑
app.get('/api/debug-records', (req, res) => {
  console.log("================== 当前记录 =================");
  callRecords.forEach((record, index) => {
    console.log(`${index}. ${record.phoneNumber} | ${record.status} | ${record.time}`);
  });
  console.log("============================================");
  res.json({ success: true, count: callRecords.length });
});

// 添加测试API
app.get('/api/test', (req, res) => {
  res.json({
    serverTime: new Date().toISOString(),
    activeCallsCount: activeCalls.size,
    callRecordsCount: callRecords.length,
    endpoints: [
      '/api/calls',
      '/api/call-records',
      '/api/call-history',
      '/api/debug-records'
    ]
  });
});

// 添加保活路由
app.get('/keep-alive', (req, res) => {
  console.log('收到保活请求:', new Date().toISOString());
  res.send('服务器正常运行中');
});

// 添加从手机端同步记录的API端点
app.post('/api/sync-records', (req, res) => {
  try {
    const { records } = req.body;
    
    console.log(`收到同步请求，客户端发送了 ${records?.length || 0} 条通话记录`);
    
    // 不再严格依赖手机发送的记录，即使手机没有发送记录，也返回服务器记录
    if (!Array.isArray(records) || records.length === 0) {
      // 返回合并后的记录给手机
      const mergedRecords = getMergedRecords();
      
      return res.json({ 
        success: true, 
        message: '已返回服务器最新记录',
        records: mergedRecords
      });
    }
    
    // 记录手机端发送的数据，方便调试
    console.log(`客户端发送的记录示例: ${JSON.stringify(records[0])}`);
    
    // 将手机记录转换为服务器记录格式
    const convertedRecords = records.map(record => ({
      id: record.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      phoneNumber: record.number,
      timestamp: new Date(record.date).getTime() || Date.now(),
      time: formatTime(new Date(record.date).getTime() || Date.now()),
      status: record.type === 'outgoing' ? '已拨打' : 
              record.type === 'incoming' ? '已接听' : 
              record.type === 'missed' ? '未接听' : '未知',
      // 如果有通话时长，也可以添加
      duration: record.duration || null
    }));
    
    // 合并记录，避免重复
    let merged = false;
    convertedRecords.forEach(mobileRecord => {
      // 首先尝试通过ID找到完全匹配的记录
      const exactMatch = callRecords.findIndex(sr => sr.id === mobileRecord.id);
      
      if (exactMatch !== -1) {
        // 如果找到完全匹配的ID，跳过这条记录
        console.log(`跳过完全匹配的记录: ${mobileRecord.id} - ${mobileRecord.phoneNumber}`);
        return;
      }
      
      // 检查是否已存在这个号码的相近时间的记录
      const existingIndex = callRecords.findIndex(sr => 
        sr.phoneNumber === mobileRecord.phoneNumber && 
        Math.abs(sr.timestamp - mobileRecord.timestamp) < 60000 // 1分钟内视为同一通电话
      );
      
      if (existingIndex === -1) {
        // 不存在，添加新记录
        callRecords.unshift(mobileRecord);
        merged = true;
        
        // 当添加新记录时，立即广播通知所有客户端
        io.emit('call_record_update', mobileRecord);
        console.log(`添加并广播新记录: ${mobileRecord.id} - ${mobileRecord.phoneNumber}`);
      }
    });
    
    // 如果有新记录合并，保存到文件
    if (merged) {
      // 按时间戳降序排序
      callRecords.sort((a, b) => b.timestamp - a.timestamp);
      
      // 如果记录超过1000条，截取前1000条
      if (callRecords.length > 1000) {
        callRecords.splice(1000);
      }
      
      // 保存到文件
      saveCallRecords();
      console.log(`合并后共有 ${callRecords.length} 条记录`);
      
      // 广播告知所有客户端有新记录
      io.emit('records_updated', {
        timestamp: Date.now(),
        count: callRecords.length
      });
    }
    
    // 获取合并后的记录
    const mergedRecords = getMergedRecords();
    
    // 向客户端返回所有记录
    res.json({
      success: true,
      message: merged ? '记录已合并' : '没有新记录',
      records: mergedRecords
    });
    
    // 确保其他客户端也能收到最新记录
    if (merged) {
      setTimeout(() => {
        io.emit('phone_record_update', {
          type: 'sync_complete',
          timestamp: Date.now(),
          recordCount: mergedRecords.length
        });
      }, 500);
    }
  } catch (error) {
    console.error('同步记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 辅助函数，获取合并后的记录，复用合并记录的逻辑
function getMergedRecords() {
  // 过滤无效的记录
  const validRecords = callRecords.filter(record => 
    record && record.phoneNumber && record.phoneNumber.trim() !== '');
  
  // 按照ID进行唯一标识
  const uniqueRecordsMap = new Map();
  
  // 先按时间戳降序排序
  const sortedRecords = [...validRecords].sort((a, b) => b.timestamp - a.timestamp);
  
  // 为每个记录使用ID作为唯一标识，如果ID不存在则使用phoneNumber+timestamp
  sortedRecords.forEach(record => {
    const key = record.id || `${record.phoneNumber}-${record.timestamp}`;
    if (!uniqueRecordsMap.has(key)) {
      uniqueRecordsMap.set(key, record);
    }
  });
  
  // 转换为数组并再次按时间戳降序排序
  return Array.from(uniqueRecordsMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter(r => r.phoneNumber && r.phoneNumber.trim() !== '');
}

// 添加获取合并后通话记录的API端点
app.get('/api/merged-call-records', (req, res) => {
  try {
    console.log('请求合并后的通话记录');
    
    // 使用辅助函数获取合并后的记录
    const finalRecords = getMergedRecords();
    
    console.log(`返回 ${finalRecords.length} 条合并后的通话记录，总记录数: ${callRecords.length}`);
    
    // 记录所有电话号码，方便调试
    const phoneNumbers = finalRecords.map(r => r.phoneNumber);
    console.log(`返回的号码列表: ${phoneNumbers.join(', ')}`);
    
    // 在响应中包含同步时间戳
    res.json({
      records: finalRecords,
      syncTime: Date.now()
    });
  } catch (error) {
    console.error('获取合并后通话记录失败:', error);
    res.status(500).json({ error: '获取合并后通话记录失败' });
  }
});

// 获取电话通话记录API
app.get('/api/phone-call-records', (req, res) => {
  console.log('收到获取通话记录请求，参数:', req.query);
  
  // 从查询参数中获取强制刷新标志和全部记录标志
  const forceRefresh = req.query.force === 'true';
  const getAllRecords = req.query.all === 'true';
  
  // 如果请求参数包含force=true或all=true，忽略lastSyncTime
  // 这样可以强制返回所有记录，不受上次同步时间限制
  if (forceRefresh || getAllRecords) {
    console.log('请求包含force=true或all=true参数，返回所有记录');
    
    // 获取所有记录
    const allRecords = getMergedRecords();
    console.log(`返回所有 ${allRecords.length} 条记录`);
    
    return res.json({
      syncTime: Date.now(),
      records: allRecords
    });
  }
  
  // 默认逻辑：根据上次同步时间过滤记录
  try {
    // 获取上次同步时间（如果没有给定参数）
    const lastSyncTime = parseInt(req.query.lastSyncTime) || 0;
    
    console.log(`上次同步时间: ${new Date(lastSyncTime).toISOString()}`);
    
    // 获取上次同步后的新记录
    const newRecords = callRecords.filter(record => record.timestamp > lastSyncTime);
    
    // 获取所有合并记录
    const allMergedRecords = getMergedRecords();
    
    console.log(`找到 ${newRecords.length} 条新记录，总共 ${allMergedRecords.length} 条记录`);
    
    // 如果没有新记录但是请求明确想要全部记录
    if (newRecords.length === 0 && req.query.includeAll === 'true') {
      return res.json({
        syncTime: Date.now(),
        records: allMergedRecords
      });
    }
    
    // 返回新记录和同步时间
    res.json({
      syncTime: Date.now(),
      records: getAllRecords ? allMergedRecords : newRecords
    });
  } catch (error) {
    console.error('获取通话记录时出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 添加一个事件推送API端点
app.post('/api/register-push', (req, res) => {
  const { deviceId, pushToken } = req.body;
  
  console.log(`注册推送设备: ${deviceId}, token: ${pushToken}`);
  
  // 这里可以添加推送通知的逻辑，例如使用Firebase Cloud Messaging
  // 由于超出本项目范围，这里只返回成功响应
  
  res.json({
    success: true,
    message: '设备注册成功',
    registered: true
  });
});

// 修改端口号和监听地址
const PORT = process.env.PORT || 5000;

// 修复自保活机制
let keepAliveInterval;
function startKeepAlive() {
  // 使用完整URL而不是依赖req对象
  const serverUrl = process.env.NODE_ENV === 'production'
    ? 'https://telephonesystem.onrender.com'
    : `http://localhost:${PORT}`;
  
  // 每14分钟自己ping一次，避免休眠
  keepAliveInterval = setInterval(async () => {
    try {
      console.log('执行自保活:', new Date().toISOString());
      await fetch(`${serverUrl}/keep-alive`);
      console.log('自保活成功');
    } catch (error) {
      console.error('自保活失败:', error);
    }
  }, 14 * 60 * 1000);
}

// 启动时开始自保活
startKeepAlive();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`服务器监听地址: 0.0.0.0 (所有网络接口)`);
  
  // 在生产环境中不输出本地URL
  if (process.env.NODE_ENV !== 'production') {
    console.log(`控制台访问地址: http://localhost:${PORT}`);
    console.log(`或通过局域网IP访问: http://[你的IP地址]:${PORT}`);
  } else {
    console.log(`服务器已在生产环境启动`);
  }
});