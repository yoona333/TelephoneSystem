import io from 'socket.io-client';
import { Platform } from 'react-native';
import { useEffect } from 'react';

// 使用环境变量动态选择API地址
export const API_URL = 'https://telephonesystem.onrender.com'; // 使用线上服务器

// 创建一个单例Socket连接
let socket: any = null;
let isConnecting = false;
let callStatusListeners: ((data: any) => void)[] = [];

// 添加这些状态追踪变量
let activeCallId: string | null = null;
let activePhoneNumber: string | null = null;
let pendingCalls: Record<string, boolean> = {};

// 可以增加一个请求防抖函数
const debounceCall = (() => {
  let timeout: NodeJS.Timeout | null = null;
  let lastPhoneNumber: string | null = null;
  let lastCallPromise: Promise<{callId: string}> | null = null;
  
  return (phoneNumber: string, callFn: () => Promise<{callId: string}>) => {
    // 如果300ms内尝试拨打相同号码，直接返回上次的Promise
    if (phoneNumber === lastPhoneNumber && lastCallPromise && timeout) {
      console.log('防抖: 300ms内忽略重复拨号请求');
      return lastCallPromise;
    }
    
    // 清除之前的超时
    if (timeout) clearTimeout(timeout);
    
    // 设置新的超时
    lastPhoneNumber = phoneNumber;
    lastCallPromise = callFn();
    
    // 300ms后重置状态
    timeout = setTimeout(() => {
      timeout = null;
      lastPhoneNumber = null;
    }, 300);
    
    return lastCallPromise;
  };
})();

// 在 socketIo 连接上添加事件监听器
const addSocketListeners = () => {
  if (!socket) return;
  
  // 监听通话状态更新
  socket.on('call_status', (data: any) => {
    console.log('收到通话状态更新:', data);
    CallService.handleCallStatusUpdate(data);
  });
  
  // 添加更多连接状态监听
  socket.io.on('reconnect_attempt', (attempt: number) => {
    console.log(`尝试重新连接服务器 (${attempt})`);
  });

  socket.io.on('reconnect', (attempt: number) => {
    console.log(`重新连接服务器成功，经过 ${attempt} 次尝试`);
  });
};

// 确保Socket连接
const ensureSocketConnection = async (): Promise<void> => {
  // 如果已经连接，直接返回
  if (socket && socket.connected) {
    console.log('Socket已连接，复用现有连接');
    return;
  }
  
  // 如果正在连接中，等待连接完成
  if (isConnecting) {
    console.log('Socket正在连接中，等待...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (socket && socket.connected) {
          console.log('等待中的Socket连接已完成');
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // 设置超时，避免无限等待
      setTimeout(() => {
        clearInterval(checkInterval);
        console.log('等待Socket连接超时，创建新连接');
        isConnecting = false;
        ensureSocketConnection().then(resolve);
      }, 5000);
    });
  }
  
  isConnecting = true;
  console.log('开始创建新的Socket连接...');
  
  return new Promise((resolve, reject) => {
    try {
      console.log('正在连接到服务器:', API_URL);
      
      // 先尝试通过 fetch 测试服务器是否可连接
      fetch(`${API_URL}/api/status`)
        .then(response => {
          console.log('服务器状态检查:', response.status);
        })
        .catch(err => {
          console.log('服务器状态检查失败:', err.message);
        });
      
      // 如果之前有socket实例，先关闭
      if (socket) {
        try {
          socket.close();
          socket.removeAllListeners();
          console.log('关闭旧Socket连接');
        } catch (err) {
          console.log('关闭旧Socket连接时出错:', err);
        }
      }
      
      // 创建新的Socket连接
      socket = io(API_URL, {
        // 增加更多选项提高连接成功率
        transports: ['polling', 'websocket'], // 先使用 polling，再尝试 websocket
        reconnection: true, 
        reconnectionAttempts: Infinity, // 无限重试
        reconnectionDelay: 1000, 
        reconnectionDelayMax: 5000, // 最大间隔5秒
        timeout: 20000, // 增加连接超时时间
        autoConnect: true, // 自动连接
        forceNew: true, // 强制使用新连接
        // @ts-ignore
        pingTimeout: 60000, // 增加心跳超时时间
        // @ts-ignore
        pingInterval: 25000, // 更频繁地发送心跳
      });
      
      socket.on('connect', () => {
        console.log('Socket连接成功到:', API_URL);
        console.log('Socket ID:', socket.id);
        isConnecting = false;
        
        // 连接成功后添加事件监听器
        addSocketListeners();
        
        resolve();
      });
      
      socket.on('connect_error', (error: any) => {
        console.error('Socket连接错误:', error);
        if (!socket.connected) {
          isConnecting = false;
          reject(error);
        }
      });
      
      socket.on('disconnect', (reason: string) => {
        console.log('Socket断开连接:', reason);
        
        // 如果是因为 ping 超时，尝试重新连接
        if (reason === 'ping timeout' || reason === 'transport close') {
          console.log('尝试重新连接...');
          setTimeout(() => {
            if (socket) socket.connect();
          }, 1000);
        }
      });
      
    } catch (error) {
      console.error('创建Socket连接失败:', error);
      isConnecting = false;
      reject(error);
    }
  });
};

// 通话服务
const CallService = {
  // 发起通话
  initiateCall: async (phoneNumber: string): Promise<{ callId: string }> => {
    return debounceCall(phoneNumber, async () => {
      try {
        // 检查是否有正在进行的通话
        if (activeCallId && activePhoneNumber === phoneNumber) {
          console.log(`已有正在进行的通话: ${activeCallId}, 号码: ${phoneNumber}`);
          return { callId: activeCallId };
        }
        
        // 检查是否有相同号码的请求正在进行中
        if (Object.prototype.hasOwnProperty.call(pendingCalls, phoneNumber)) {
          console.log(`忽略重复拨打请求: ${phoneNumber}`);
          return { callId: `temp-${Date.now()}` }; // 返回临时ID避免错误
        }
        
        // 标记该号码正在请求中
        pendingCalls[phoneNumber] = true;
        
        await ensureSocketConnection();
        
        const response = await fetch(`${API_URL}/api/call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber })
        });
        
        if (!response.ok) {
          throw new Error(`API错误: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('通话已发起:', data);
        
        // 更新当前活动通话信息
        activeCallId = data.callId;
        activePhoneNumber = phoneNumber;
        
        return data;
      } catch (error) {
        console.error('发起通话失败:', error);
        throw error;
      } finally {
        // 完成后清除pending状态
        delete pendingCalls[phoneNumber];
      }
    });
  },
  
  // 挂断通话
  hangupCall: async (callId: string): Promise<void> => {
    // 检查是否是临时ID
    if (callId.startsWith('temp-')) {
      console.log(`忽略挂断临时ID: ${callId}`);
      return; // 直接返回，不发送请求
    }
    
    try {
      await ensureSocketConnection();
      
      // 尝试挂断前检查是否是当前活动通话
      if (activeCallId === callId) {
        const response = await fetch(`${API_URL}/api/hangup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ callId })
        });
        
        // 即使API返回404，也要清除活动通话状态
        if (!response.ok && response.status !== 404) {
          throw new Error(`API错误: ${response.status}`);
        }
        
        console.log('通话已挂断:', callId);
        
        // 清除活动通话状态
        activeCallId = null;
        activePhoneNumber = null;
      } else {
        console.log(`忽略挂断非活动通话: ${callId}`);
      }
    } catch (error) {
      console.error('挂断通话失败:', error);
      // 即使失败也清除状态，避免卡死
      activeCallId = null;
      activePhoneNumber = null;
      throw error;
    }
  },
  
  // 订阅通话状态更新
  subscribeToCallStatus: (callback: (data: any) => void): void => {
    if (!socket) {
      console.log('Socket未初始化，无法订阅通话状态更新');
      // 将回调存储起来，等socket连接后再添加
      setTimeout(() => {
        if (socket) {
          console.log('Socket已就绪，添加通话状态更新监听');
          socket.on('call_status', callback);
        } else {
          console.log('Socket仍未就绪，无法添加监听');
        }
      }, 2000);
      return;
    }

    callStatusListeners.push(callback);
    
    // 添加直接监听
    socket.on('call_status', callback);
  },
  
  // 取消订阅
  unsubscribeFromCallStatus: (callback: (data: any) => void): void => {
    if (!socket) {
      console.log('Socket未初始化，无需取消订阅');
      return;
    }
    
    callStatusListeners = callStatusListeners.filter(listener => listener !== callback);
    
    // 移除直接监听
    socket.off('call_status', callback);
  },
  
  // 检查服务器状态
  checkServerStatus: async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${API_URL}/api/status`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('检查服务器状态失败:', error);
      return false;
    }
  },
  
  // 添加设置离线模式的方法
  setOfflineMode: (isOffline: boolean): void => {
    console.log(`设置离线模式: ${isOffline}`);
    // 实现离线模式逻辑
    // 例如，可以在这里存储一个标志，在其他方法中检查这个标志
  },
  
  // 处理通话状态更新
  handleCallStatusUpdate: (data: any): void => {
    // 当收到ended状态时自动清除活动通话
    if (data.status === 'ended' && activeCallId === data.callId) {
      console.log(`通话结束，清除活动通话状态: ${data.callId}`);
      activeCallId = null;
      activePhoneNumber = null;
    }
    
    // 通知所有监听器
    callStatusListeners.forEach(listener => listener(data));
  },
  
  // 添加获取通话记录的方法
  getCallRecords: async (): Promise<any[]> => {
    try {
      // 打印详细请求URL，便于调试
      const url = `${API_URL}/api/call-records`;
      console.log("请求通话记录URL:", url);
      
      const response = await fetch(url, {
        // 禁用缓存
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API错误: ${response.status}, 内容: ${errorText}`);
        throw new Error(`API错误: ${response.status}`);
      }
      
      const records = await response.json();
      console.log(`获取了 ${records.length} 条通话记录`);
      return records;
    } catch (error) {
      console.error('获取通话记录失败:', error);
      // 出错时返回空数组而不是抛出异常
      return [];
    }
  },
  
  // 订阅通话记录更新
  subscribeToCallRecords: (callback: (record: any) => void): void => {
    if (!socket) {
      console.log('Socket未初始化，无法订阅通话记录更新');
      // 将回调存储起来，等socket连接后再添加
      setTimeout(() => {
        if (socket) {
          console.log('Socket已就绪，添加通话记录更新监听');
          socket.on('call_record_update', callback);
        } else {
          console.log('Socket仍未就绪，无法添加监听');
        }
      }, 2000);
      return;
    }
    
    socket.on('call_record_update', callback);
  },
  
  // 取消订阅通话记录更新
  unsubscribeFromCallRecords: (callback: (record: any) => void): void => {
    if (!socket) {
      console.log('Socket未初始化，无需取消订阅');
      return;
    }
    
    socket.off('call_record_update', callback);
  },
  
  // 添加手机记录同步方法
  syncCallRecords: async (phoneRecords: any[]): Promise<boolean> => {
    try {
      console.log(`准备同步 ${phoneRecords.length} 条手机记录到服务器`);
      const response = await fetch(`${API_URL}/api/sync-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneRecords })
      });
      
      if (!response.ok) {
        throw new Error(`API错误: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`同步完成，服务器共有 ${result.recordCount} 条记录`);
      return true;
    } catch (error) {
      console.error('同步通话记录失败:', error);
      return false;
    }
  },
  
  // 添加去重方法
  getUniqueCallRecords: async (): Promise<any[]> => {
    const records = await CallService.getCallRecords();
    
    // 使用Map去重，以phoneNumber和timestamp为键
    const uniqueMap = new Map();
    records.forEach(record => {
      const key = `${record.phoneNumber}-${record.timestamp}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, record);
      }
    });
    
    // 转回数组并按时间戳排序
    return Array.from(uniqueMap.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  },
  
  // 修改 checkConnection 方法
  checkConnection: async (): Promise<boolean> => {
    try {
      console.log(`检查服务器连接: ${API_URL}/api/test`);
      
      // 使用 AbortController 代替直接的 timeout 参数
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${API_URL}/api/test`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('服务器状态:', data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('服务器连接失败:', error);
      return false;
    }
  },
  
  // 添加一个预热函数
  warmupServer: async (): Promise<boolean> => {
    console.log("预热服务器...");
    try {
      // 尝试多次唤醒服务器
      for (let i = 0; i < 3; i++) {
        console.log(`尝试唤醒服务器 (${i+1}/3)...`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch(`${API_URL}/api/status`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log('服务器已唤醒');
            return true;
          }
        } catch (e) {
          console.log('唤醒失败，重试...');
        }
        
        // 等待2秒后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log('服务器可能在睡眠中');
      return false;
    } catch (error) {
      console.error('唤醒服务器失败:', error);
      return false;
    }
  },
  
  // 添加定期检查函数
  startPollingCheck: () => {
    console.log('开始轮询服务器状态...');
    const interval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${API_URL}/api/status`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log('服务器在线 (通过轮询检测)');
        }
      } catch (error) {
        console.log('服务器离线或睡眠中 (通过轮询检测)');
      }
    }, 60000); // 每60秒检查一次
    
    return () => clearInterval(interval); // 返回清理函数
  }
};

// 初始化时调用
console.log('开始连接至服务器:', API_URL);
setTimeout(() => {
  CallService.warmupServer()
    .then(success => {
      console.log('服务器预热结果:', success ? '成功' : '失败');
      if (success) {
        // 启动轮询检查
        CallService.startPollingCheck();
      } else {
        console.error('无法连接到服务器，请检查网络或服务器状态');
      }
    })
    .catch(err => {
      console.error('服务器预热出错:', err);
    });
}, 1000); // 延迟1秒执行，确保应用完全初始化

export default CallService;