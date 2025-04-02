import io, { Socket } from 'socket.io-client';
import { Alert } from 'react-native';

// 服务器地址 - 使用本地IP地址而不是localhost
// 注意：在真机上测试时，需要使用电脑的局域网IP地址
export const API_URL = 'https://你的render服务名称.onrender.com';

// 定义回调函数类型
type CallbackFunction = (data: any) => void;

// 修改连接设置，使用离线模式作为备选
let USE_OFFLINE_MODE = false; // 使用在线模式
let socket: Socket | undefined;

// 添加轮询间隔变量
let pollInterval: NodeJS.Timeout | null = null;

// 尝试连接服务器
if (!USE_OFFLINE_MODE) {
  try {
    socket = io(API_URL, {
      transports: ['polling', 'websocket'], // 先尝试polling，再尝试websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000, // 进一步增加超时时间
      forceNew: true,
      upgrade: false // 禁用自动升级到WebSocket
    });
    
    socket.on('connect', () => {
      console.log('Socket连接成功');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket连接错误:', error);
    });
    
    socket.on('connect_timeout', () => {
      console.error('Socket连接超时');
    });
  } catch (error) {
    console.error('初始化socket失败:', error);
  }
}

class CallService {
  // 当前通话ID
  currentCallId: string | null = null;
  
  // 监听器
  listeners = new Set<CallbackFunction>();
  
  constructor() {
    // 监听通话状态变化
    if (socket) {
      socket.on('call_status', (data) => {
        console.log('Call status update received:', data);
        this.notifyListeners(data);
      });
    }
  }
  
  // 添加监听器
  addListener(callback: CallbackFunction) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  // 通知所有监听器
  notifyListeners(data: any) {
    this.listeners.forEach(callback => callback(data));
  }
  
  // 开始轮询通话状态
  startPolling() {
    if (pollInterval) return;
    
    pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/calls`);
        const calls = await response.json();
        
        // 处理每个通话状态
        calls.forEach(call => {
          this.notifyListeners(call);
        });
      } catch (error) {
        console.error('轮询通话状态失败:', error);
      }
    }, 2000); // 每2秒轮询一次
  }
  
  // 停止轮询
  stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }
  
  // 拨打电话
  async makeCall(phoneNumber: string) {
    try {
      console.log('正在拨打电话:', phoneNumber);
      console.log('服务器地址:', API_URL);
      console.log('离线模式:', USE_OFFLINE_MODE);
      console.log('Socket连接状态:', socket ? (socket.connected ? '已连接' : '未连接') : '未初始化');
      
      // 开始轮询以获取状态更新
      this.startPolling();
      
      const response = await fetch(`${API_URL}/api/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });
      
      console.log('服务器响应:', response.status);
      const data = await response.json();
      console.log('响应数据:', data);
      
      if (response.ok) {
        this.currentCallId = data.callId;
        return data;
      } else {
        throw new Error(data.error || '拨打电话失败');
      }
    } catch (error) {
      console.error('拨打电话错误详情:', JSON.stringify(error));
      console.log('切换到离线模式');
      return this.makeCallOffline(phoneNumber);
    }
  }
  
  // 离线模式拨打电话
  private makeCallOffline(phoneNumber: string) {
    this.currentCallId = Date.now().toString();
    
    console.log('使用离线模式拨打电话:', phoneNumber);
    
    // 模拟通话状态变化
    setTimeout(() => {
      this.notifyListeners({ 
        callId: this.currentCallId, 
        phoneNumber, 
        status: 'ringing' 
      });
    }, 500);
    
    setTimeout(() => {
      this.notifyListeners({ 
        callId: this.currentCallId, 
        phoneNumber, 
        status: 'active' 
      });
    }, 3000);
    
    return { callId: this.currentCallId };
  }
  
  // 接听电话
  async answerCall(callId: string) {
    try {
      if (!socket || !socket.connected) {
        // 模拟接听
        this.notifyListeners({ 
          callId, 
          status: 'active' 
        });
        return { success: true };
      }
      
      const response = await fetch(`${API_URL}/api/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callId }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || '接听电话失败');
      }
    } catch (error) {
      console.error('Answer call error:', error);
      
      // 模拟接听
      this.notifyListeners({ 
        callId, 
        status: 'active' 
      });
      
      return { success: true };
    }
  }
  
  // 挂断电话
  async hangupCall(callId: string | null = this.currentCallId) {
    if (!callId) return;
    
    try {
      if (!socket || !socket.connected) {
        // 模拟挂断
        this.notifyListeners({ 
          callId, 
          status: 'ended',
          duration: 30 // 模拟30秒通话
        });
        
        this.currentCallId = null;
        return { success: true };
      }
      
      const response = await fetch(`${API_URL}/api/hangup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callId }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        this.currentCallId = null;
        return data;
      } else {
        throw new Error(data.error || '挂断电话失败');
      }
    } catch (error) {
      console.error('Hangup call error:', error);
      
      // 模拟挂断
      this.notifyListeners({ 
        callId, 
        status: 'ended',
        duration: 30 // 模拟30秒通话
      });
      
      this.currentCallId = null;
      return { success: true };
    } finally {
      // 通话结束后停止轮询
      this.stopPolling();
    }
  }

  // 添加设置离线模式的方法
  setOfflineMode(offline: boolean) {
    console.log('设置离线模式:', offline);
    USE_OFFLINE_MODE = offline;
  }
}

export default new CallService(); 