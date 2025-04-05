import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { CallService } from './services/CallService';

const App: React.FC = () => {
  useEffect(() => {
    const setupServer = async () => {
      console.log("应用启动，开始唤醒服务器...");
      // 初始化轮询
      const cleanupPolling = CallService.startPollingCheck();
      
      // 多次尝试唤醒服务器
      for (let i = 0; i < 3; i++) {
        const success = await CallService.warmupServer();
        if (success) {
          console.log("服务器已唤醒");
          break;
        }
        
        console.log(`唤醒尝试 ${i+1}/3 失败，等待更长时间...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
      }
      
      return () => cleanupPolling(); // 组件卸载时停止轮询
    };
    
    setupServer();
  }, []);

  return (
    // Rest of the component code
  );
};

export default App; 