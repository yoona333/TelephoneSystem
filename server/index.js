const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // 增加ping超时时间
  pingInterval: 25000, // 增加ping间隔
  transports: ['websocket', 'polling'] // 支持多种传输方式
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

// 设置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 存储活跃通话
const activeCalls = new Map();

// 路由
app.get('/api/status', (req, res) => {
  res.json({ status: 'running' });
});

// 获取所有活跃通话
app.get('/api/calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([id, call]) => ({
    callId: id,
    ...call
  }));
  res.json(calls);
});

// 处理呼叫请求
app.post('/api/call', (req, res) => {
  console.log('收到呼叫请求:', req.body);
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    console.log('错误：缺少电话号码');
    return res.status(400).json({ error: '缺少电话号码' });
  }
  
  // 生成通话ID
  const callId = Date.now().toString();
  console.log('生成通话ID:', callId);
  
  // 存储通话信息
  activeCalls.set(callId, {
    phoneNumber,
    startTime: new Date(),
    status: 'ringing'
  });
  
  // 广播通话状态
  console.log('广播通话状态:', { callId, phoneNumber, status: 'ringing' });
  io.emit('call_status', { 
    callId, 
    phoneNumber, 
    status: 'ringing' 
  });
  
  res.json({ callId });
});

// 接听电话
app.post('/api/answer', (req, res) => {
  const { callId } = req.body;
  
  if (!callId || !activeCalls.has(callId)) {
    return res.status(404).json({ error: '通话不存在' });
  }
  
  const call = activeCalls.get(callId);
  
  if (call.status !== 'ringing') {
    return res.status(400).json({ error: '通话状态错误' });
  }
  
  call.status = 'active';
  
  io.emit('call_status', { 
    callId, 
    phoneNumber: call.phoneNumber, 
    status: 'active' 
  });
  
  res.json({ success: true });
});

// 挂断电话
app.post('/api/hangup', (req, res) => {
  const { callId } = req.body;
  
  if (!callId || !activeCalls.has(callId)) {
    return res.status(404).json({ error: '通话不存在' });
  }
  
  const call = activeCalls.get(callId);
  call.status = 'ended';
  call.endTime = new Date();
  
  io.emit('call_status', { 
    callId, 
    phoneNumber: call.phoneNumber, 
    status: 'ended',
    duration: (call.endTime - call.startTime) / 1000 // 通话时长（秒）
  });
  
  // 从活跃通话中移除
  setTimeout(() => {
    activeCalls.delete(callId);
  }, 1000);
  
  res.json({ success: true });
});

// WebSocket连接
io.on('connection', (socket) => {
  console.log('客户端已连接, ID:', socket.id);
  console.log('客户端传输方式:', socket.conn.transport.name);
  
  socket.on('disconnect', (reason) => {
    console.log('客户端已断开连接, ID:', socket.id, '原因:', reason);
  });
  
  socket.on('error', (error) => {
    console.log('Socket错误:', error);
  });
});

// 修改端口号和监听地址
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`控制台访问地址: http://localhost:${PORT}`);
  console.log(`或通过局域网IP访问: http://192.168.83.138:${PORT}`);
});