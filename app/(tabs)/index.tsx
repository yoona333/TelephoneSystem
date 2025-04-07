import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, FlatList, Dimensions, StatusBar, Modal, SafeAreaView, Platform, Animated, Alert, TextInput, Switch, Easing, Keyboard, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CallScreen from '@/components/CallScreen';
import CallService, { API_URL } from '@/services/CallService';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ExpoHaptics from 'expo-haptics';
import { getPhoneLocation } from '@/services/PhoneLocationService';
import io from 'socket.io-client';
import * as Clipboard from 'expo-clipboard';

// 获取屏幕宽度和高度
const { width, height } = Dimensions.get('window');

// 添加一个接口定义通话数据的类型
interface CallStatusData {
  callId: string;
  status: 'ringing' | 'active' | 'ended';
  phoneNumber?: string;
  duration?: number;
}

// 添加类型定义
interface CallItem {
  id: string;
  name: string;
  number: string;
  date: string;
  type: 'outgoing' | 'incoming' | 'missed';
}

interface CallData {
  callId: string;
}

// 存储键
const CALL_HISTORY_STORAGE_KEY = 'call_history';

// 添加菜单选项类型
interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// 自定义FourDots组件
const FourDots = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={{ 
      width: 24, 
      height: 24, 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      justifyContent: 'center',
      alignItems: 'center',
      padding: 3
    }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ 
          width: 3.5, 
          height: 3.5, 
          borderRadius: 1.5, 
          backgroundColor: isDark ? '#FFFFFF' : '#000000', 
          margin: 3.5 
        }} />
        <View style={{ 
          width: 3.5, 
          height: 3.5, 
          borderRadius: 1.5, 
          backgroundColor: isDark ? '#FFFFFF' : '#000000', 
          margin: 3.5 
        }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ 
          width: 3.5, 
          height: 3.5, 
          borderRadius: 1.5, 
          backgroundColor: isDark ? '#FFFFFF' : '#000000', 
          margin: 3.5 
        }} />
        <View style={{ 
          width: 3.5, 
          height: 3.5, 
          borderRadius: 1.5, 
          backgroundColor: isDark ? '#FFFFFF' : '#000000', 
          margin: 3.5 
        }} />
      </View>
    </View>
  );
};

// 1. 创建一个单独的CallItem组件
const CallItemComponent = React.memo(({ item, onPress, handleCall }: { 
  item: CallItem, 
  onPress: (item: CallItem) => void,
  handleCall: (number: string) => void 
}) => {
  const [location, setLocation] = useState<string>("");
  const [operator, setOperator] = useState<string>("");
  const [isValidNumber, setIsValidNumber] = useState<boolean>(false);
  const colorScheme = useColorScheme();
  
  useEffect(() => {
    let isMounted = true;
    
    // 检查是否是有效的手机号码
    const isValid = item.number && /^1\d{10}$/.test(item.number);
    setIsValidNumber(!!isValid);
    
    if (isValid) {
      const fetchLocation = async () => {
        try {
          const result = await getPhoneLocation(item.number);
          
          if (isMounted) {
            // 只有当结果不是"未知归属地"时才设置location
            if (result && result !== "未知归属地" && result !== "未知归属地 未知运营商") {
              // 分离归属地和运营商
              const parts = result.split(' ');
              if (parts.length > 1) {
                setLocation(parts[0] || "");
                setOperator(parts[1] || "");
              } else {
                setLocation(result);
              }
              
              // 只在首次获取时记录日志，减少重复日志
              console.log(`使用${result.includes('缓存') ? '缓存的' : ''}归属地: ${result}`);
            }
          }
        } catch (error) {
          if (isMounted) {
            // 出错时不显示任何内容
            setLocation("");
            setOperator("");
          }
        }
      };
      
      fetchLocation();
    }
    
    return () => {
      isMounted = false;
    };
  }, [item.number]);
  
  return (
    <TouchableOpacity 
      style={styles.callItem}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Ionicons 
          name="call-outline" 
          size={22} 
          color="#999999"
          style={{marginRight: 15}}
        />
        <View style={{flex: 1}}>
          <ThemedText style={{fontSize: 18, color: '#FFFFFF', fontWeight: '500'}}>
            {item.number}
        </ThemedText>
          <View style={{flexDirection: 'row', marginTop: 4, alignItems: 'center'}}>
            {operator ? (
              <View style={{backgroundColor: '#333', borderRadius: 4, marginRight: 8, paddingHorizontal: 4}}>
                <Text style={{color: '#FFFFFF', fontSize: 12}}>{operator === "中国移动" ? "移动" : 
                                                               operator === "中国联通" ? "联通" : 
                                                               operator === "中国电信" ? "电信" : operator}</Text>
              </View>
            ) : null}
            
            {/* 显示归属地信息或未知 */}
            {location ? (
              <Text style={{color: '#999999', fontSize: 14}}>{location}</Text>
            ) : (
              <Text style={{color: '#999999', fontSize: 14}}>{isValidNumber ? "" : "未知"}</Text>
            )}
          </View>
        </View>
        <Text style={{color: '#999999', fontSize: 14, marginRight: 15}}>
          {item.date.includes('天前') ? item.date : 
          item.date.includes('分钟前') ? item.date.replace('今天 ', '') : 
          item.date.replace(/.*(\d{2}:\d{2})$/, '$1')}
        </Text>
        <TouchableOpacity 
          style={{padding: 5}}
          onPress={(e) => {
            e.stopPropagation();
            // 显示详情
          }}
        >
          <Ionicons name="information-circle-outline" size={24} color="#999999" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// 添加通话类型图标组件
const CallTypeIcon = ({ type }: { type: 'outgoing' | 'incoming' | 'missed' }) => {
  if (type === 'outgoing') {
    return <Ionicons name="arrow-up-outline" size={12} color="#4CD964" style={{marginRight: 5}} />;
  } else if (type === 'incoming') {
    return <Ionicons name="arrow-down-outline" size={12} color="#4CD964" style={{marginRight: 5}} />;
  } else if (type === 'missed') {
    return <Ionicons name="close-outline" size={12} color="#FF3B30" style={{marginRight: 5}} />;
  }
  return null;
};

export default function PhoneScreen() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' 或 'missed'
  const [dialPadVisible, setDialPadVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [callData, setCallData] = useState<CallData | null>(null);
  const [callHistory, setCallHistory] = useState<CallItem[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [menuVisible, setMenuVisible] = useState(false);
  
  // 添加同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // 添加动画值
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 在 PhoneScreen 组件中添加
  const [serverConnected, setServerConnected] = useState(false);

  // 添加状态用于控制导航头部显示
  const [headerVisible, setHeaderVisible] = useState(true);

  // 添加离线模式切换
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // 添加服务器状态检查
  const [serverAwake, setServerAwake] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);

  // 添加状态存储当前输入号码的归属地
  const [currentLocation, setCurrentLocation] = useState<string>("");

  // 添加防抖逻辑
  const [isCallInProgress, setIsCallInProgress] = useState(false);

  // 添加节流函数
  const throttleFlag = useRef(false);

  // 添加搜索词
  const [searchTerm, setSearchTerm] = useState('');

  // 添加服务器状态
  const [serverStatus, setServerStatus] = useState('unknown');

  // 添加下拉菜单状态
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // 添加加载服务器记录状态
  const [loadingServerRecords, setLoadingServerRecords] = useState(false);

  // 获取socket连接
  const socketRef = useRef<any>(null);
  
  // 在PhoneScreen组件顶部声明部分添加一个新变量，用于跟踪挂断过的通话
  const processedHangupCallIds = useRef(new Set<string>());
  
  useEffect(() => {
    // 初始化socket连接
    const initSocket = async () => {
      try {
        // 连接到服务器
        socketRef.current = io(API_URL, {
          transports: ['polling', 'websocket'],
          reconnection: true
        });
        
        // 设置连接事件
        socketRef.current.on('connect', () => {
          console.log('Socket连接成功, ID:', socketRef.current.id);
        });
        
        socketRef.current.on('disconnect', (reason: string) => {
          console.log('Socket断开连接:', reason);
        });
        
        // 订阅服务器通话记录实时更新
        CallService.subscribeToCallRecords((record) => {
          console.log('收到服务器记录更新:', record);
          // 将服务器记录转换为客户端格式
          if (record && record.phoneNumber) {
            try {
              // 确定记录类型
              let recordType: 'outgoing' | 'incoming' | 'missed' = 'missed';
              if (record.status === '已拨打') recordType = 'outgoing';
              else if (record.status === '已接听') recordType = 'incoming';
              
              const callItem: CallItem = {
                id: record.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                name: '',
                number: record.phoneNumber,
                date: formatDate(new Date(record.timestamp || Date.now())),
                type: recordType
              };
              
              // 添加到本地记录
              addNewCallRecord(callItem);
            } catch (e) {
              console.error('处理服务器记录更新失败:', e);
            }
          }
        });
        
        // 也监听记录全量更新事件
        const handleRecordsUpdated = () => {
          console.log('收到服务器记录全量更新通知，立即触发同步...');
          
          // 强制重新加载所有记录
          forceReloadFromServer().catch(err => 
            console.error('强制更新记录失败:', err)
          );
        };
        
        // 添加Socket事件监听
        socketRef.current.on('records_updated', handleRecordsUpdated);
        socketRef.current.on('phone_record_update', (data: any) => {
          console.log('收到手机记录更新:', data);
          // 不论收到什么类型的更新，都强制同步
          handleRecordsUpdated();
        });
        
        // 监听记录清空事件
        socketRef.current.on('records_cleared', (data: any) => {
          console.log('收到服务器记录清空通知:', data);
          // 立即清空本地记录
          setCallHistory([]);
          console.log('已清空本地通话记录');
        });
      } catch (error) {
        console.error('初始化Socket失败:', error);
      }
    };
    
    // 调用初始化
    initSocket();
    
    // 清理函数
    return () => {
      console.log('取消订阅服务器通话记录更新');
      CallService.unsubscribeFromCallRecords(() => {});
      if (socketRef.current) {
        socketRef.current.off('records_updated');
        socketRef.current.off('phone_record_update');
        socketRef.current.off('records_cleared');
        socketRef.current.disconnect();
      }
    };
  }, []);

  // 应用启动时首先尝试获取服务器的记录
  useEffect(() => {
    // 调用初始加载函数
    initialLoad().catch(err => {
      console.error('初始加载调用失败:', err);
      loadCallHistory(); // 出错时仍然尝试从本地加载
    });
  }, []);

  // 初始加载函数
  const initialLoad = async () => {
    console.log('执行初始加载...');
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptLoad = async () => {
      try {
        setLoadingServerRecords(true);
        
        // 先检查服务器状态
        const isServerAvailable = await CallService.checkConnection();
        if (!isServerAvailable) {
          console.log('服务器当前不可用，使用本地记录');
          loadCallHistory();
          return false;
        }
        
        // 尝试从服务器获取最新记录
        console.log('尝试从服务器直接获取最新记录');
        const uniqueRecords = await CallService.getUniqueCallRecords();
        console.log(`从服务器获取到 ${uniqueRecords.length} 条去重后的记录`);
        
        // 如果成功获取到记录
        if (uniqueRecords && uniqueRecords.length > 0) {
          // 转换记录格式
          const processedRecords = uniqueRecords.map(record => {
            return {
              id: record.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              name: '',
              number: record.number,
              date: formatDate(new Date(record.date)),
              type: record.type as 'outgoing' | 'incoming' | 'missed'
            } as CallItem;
          });
          
          // 设置并保存记录
          setCallHistory(processedRecords);
          saveCallHistory(processedRecords);
          console.log(`初始加载成功，从服务器加载了 ${processedRecords.length} 条记录`);
          return true;
        } else {
          // 如果没有获取到记录，尝试加载本地记录
          console.log('服务器没有记录，尝试加载本地记录');
          loadCallHistory();
          return true;
        }
      } catch (error) {
        console.error(`初始加载失败 (尝试 ${retryCount + 1}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          console.log(`${retryCount}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
          return false;
        } else {
          // 最后尝试失败后，加载本地记录
          console.log('重试次数已用完，回退到本地记录');
          loadCallHistory();
          return true;
        }
      } finally {
        setLoadingServerRecords(false);
      }
    };
    
    // 开始重试循环
    let success = false;
    while (!success && retryCount < maxRetries) {
      success = await attemptLoad();
    }
  };

  // 强制从服务器重新加载全部记录
  const forceReloadFromServer = async () => {
    try {
      console.log('强制从服务器重新加载记录...');
      setLoadingServerRecords(true);
      
      // 不显示弹窗，静默执行
      console.log('开始强制从服务器获取所有记录');
      
      // 先检查服务器连接
      const isConnected = await CallService.checkConnection();
      if (!isConnected) {
        console.log('服务器连接失败，无法强制同步');
        // 静默处理失败情况
        return;
      }
      
      // 直接调用去重方法获取记录
      const uniqueRecords = await CallService.getUniqueCallRecords();
      console.log(`获取到 ${uniqueRecords.length} 条去重后的记录`);
      
      if (uniqueRecords.length > 0) {
        // 转换服务器记录格式
        const processedRecords = uniqueRecords.map(record => {
          return {
            id: record.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            name: '',
            number: record.number,
            date: formatDate(new Date(record.date)),
            type: record.type as 'outgoing' | 'incoming' | 'missed'
          } as CallItem;
        });
        
        // 替换本地记录
        setCallHistory(processedRecords);
        // 无需保存到本地
        
        console.log(`已从服务器加载 ${processedRecords.length} 条记录`);
      } else {
        // 如果服务器上没有记录，清空本地记录
        console.log('服务器上没有通话记录，清空本地记录');
        setCallHistory([]);
      }
    } catch (error: any) {
      console.error('强制加载服务器记录失败:', error);
      
      // 静默处理错误，只记录日志
      if (error.message && error.message.includes('502')) {
        console.log('服务器返回502错误，可能正在休眠');
        // 静默尝试唤醒服务器
        wakeupServerSilent();
      } else {
        console.log('无法从服务器获取记录，请检查网络连接');
      }
    } finally {
      setLoadingServerRecords(false);
    }
  };

  // 添加静默唤醒服务器函数
  const wakeupServerSilent = async () => {
    if (checkingServer) return;
    
    try {
      setCheckingServer(true);
      console.log('静默唤醒服务器...');
      
      // 先做一个简单的状态检查请求
      const statusCheck = await fetch(`${API_URL}/api/status`, { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => null);
      
      if (statusCheck && statusCheck.ok) {
        console.log('服务器已经在线，无需唤醒');
        setServerAwake(true);
        return;
      }
      
      // 执行多次请求唤醒服务器
      for (let i = 0; i < 5; i++) {
        console.log(`唤醒尝试 ${i+1}/5...`);
        
        try {
          const response = await fetch(`${API_URL}/api/status`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            console.log('服务器已唤醒！');
            setServerAwake(true);
            
            // 成功唤醒后静默重新加载记录
            setTimeout(() => {
              forceReloadFromServer().catch(err => console.error('重新加载记录失败:', err));
            }, 3000);
            
            return;
          }
        } catch (error) {
          console.log(`尝试 ${i+1} 失败，等待重试...`);
        }
        
        // 等待3秒后再尝试
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log('唤醒服务器失败，可能处于维护状态');
    } catch (error) {
      console.error('唤醒服务器出错:', error);
    } finally {
      setCheckingServer(false);
    }
  };

  // 合并服务器记录到本地记录
  const mergeServerRecords = (serverRecords: any[]) => {
    // 获取当前本地记录
    setCallHistory(prevHistory => {
      // 创建一个映射来检查本地是否已存在相同记录
      const existingRecords = new Map();
      prevHistory.forEach(record => {
        existingRecords.set(record.number + '-' + new Date(record.date).getTime(), record);
      });
      
      // 转换服务器记录到本地格式并过滤掉已存在的
      const newRecords = serverRecords
        .filter(sr => {
          const key = sr.phoneNumber + '-' + sr.timestamp;
          return !existingRecords.has(key);
        })
        .map(sr => {
          // 确保类型符合CallItem要求
          let callType: 'outgoing' | 'incoming' | 'missed' = 'outgoing';
          
          if (sr.status === '已接听') {
            callType = 'incoming';
          } else if (sr.status === '未接听') {
            callType = 'missed';
          }
          
          return {
            id: sr.id.toString(),
            name: '',
            number: sr.phoneNumber,
            date: formatDate(new Date(sr.timestamp)),
            type: callType
          } as CallItem;
        });
      
      if (newRecords.length > 0) {
        console.log(`合并 ${newRecords.length} 条新记录到本地`);
        
        // 合并并按时间排序
        const merged = [...prevHistory, ...newRecords].sort((a, b) => {
          return parseDate(b.date).getTime() - parseDate(a.date).getTime();
        });
        
        // 保存到本地存储
        saveCallHistory(merged);
        return merged;
      }
      
      return prevHistory;
    });
  };
  
  // 添加新的通话记录，避免重复
  const addNewCallRecord = (record: CallItem) => {
    // 确保记录有一个唯一ID
    if (!record.id || record.id.trim() === '') {
      record.id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    
    setCallHistory(prevHistory => {
      // 检查是否已存在完全相同的记录
      const isDuplicate = prevHistory.some(existing => 
        existing.id === record.id || (
          existing.number === record.number &&
          Math.abs(parseDate(existing.date).getTime() - parseDate(record.date).getTime()) < 5000 // 5秒内的记录
        )
      );
      
      if (isDuplicate) {
        console.log('跳过添加完全相同的记录:', record.number, record.id);
        return prevHistory;
      }
      
      // 添加新记录并排序
      const updated = [record, ...prevHistory].sort((a, b) => 
        parseDate(b.date).getTime() - parseDate(a.date).getTime()
      );
      
      // 保存到本地存储
      saveCallHistory(updated);
      
      // 立即同步到服务器
      syncRecordsWithServer();
      
      return updated;
    });
  };
  
  // 同步本地记录到服务器
  const syncRecordsWithServer = async () => {
    try {
      console.log('开始与服务器同步通话记录...');
      
      // 检查是否有网络连接
      const isConnected = await CallService.checkConnection();
      if (!isConnected) {
        console.log('无法连接到服务器，跳过同步');
        return;
      }
      
      // 获取本地记录并发送到服务器
      const success = await CallService.syncCallRecords(callHistory);
      
      if (success) {
        console.log('通话记录同步成功，立即强制更新本地记录');
        
        // 强制获取全部服务器记录
        await forceReloadFromServer();
      }
    } catch (error) {
      console.error('同步通话记录失败:', error);
    }
  };

  // 完全重写通话记录管理逻辑 - 整合了两个监听器为单一监听器
  useEffect(() => {
    const handleCallStatus = (data: any) => {
      if (!data) return;
      
      // 安全日志 - 隐藏完整电话号码
      const safePhone = data.phoneNumber ? maskPhoneNumber(data.phoneNumber) : '未知号码';
      const safeCallId = data.callId ? data.callId.substring(0, 4) + '***' : '无ID';
      
      console.log(`通话状态更新: ${data.status || '未知状态'}, 号码: ${safePhone}, ID: ${safeCallId}`);
      
      // 如果是通话结束事件
      if (data.status === 'ended' && data.phoneNumber && data.callId) {
        // 检查这个通话ID是否已经处理过挂断事件
        if (processedHangupCallIds.current.has(data.callId)) {
          console.log(`通话 ${safeCallId} 已处理过挂断，忽略重复事件`);
          return;
        }
        
        // 如果是当前活跃通话，自动关闭通话界面
        if (callActive && callData?.callId === data.callId) {
          console.log('服务器通知通话已结束，关闭通话界面');
          setCallActive(false);
          setHeaderVisible(true);
          setDialPadVisible(false);
          setCallData(null);
          
          // 清空电话号码，准备接受新的输入
          setPhoneNumber('');
        }
        
        // 添加到已处理集合
        processedHangupCallIds.current.add(data.callId);
        
        // 设置定时器，60秒后从集合中删除，允许将来同一callId再次处理
        setTimeout(() => {
          processedHangupCallIds.current.delete(data.callId);
          console.log(`通话 ${safeCallId} 的处理锁定已释放`);
        }, 60000);
        
        // 延迟5秒从服务器获取更新的记录
        setTimeout(() => {
          try {
            forceReloadFromServer().catch(err => {
              console.error('获取服务器记录失败:', err);
            });
            console.log(`通话 ${safeCallId} 结束后已触发记录同步`);
          } catch (error) {
            console.error('通话结束后同步记录失败:', error);
          }
        }, 5000);
      }
      // 如果收到接通命令，更新UI状态
      else if (data.command === 'answer' && callData?.callId === data.callId) {
        console.log(`通话已被接通: ${safeCallId}`);
        // 可以在这里更新UI状态
      }
    };
    
    // 添加监听器
    try {
      CallService.subscribeToCallStatus(handleCallStatus);
    } catch (error) {
      console.error('订阅通话状态更新失败:', error);
    }
    
    return () => {
      try {
        CallService.unsubscribeFromCallStatus(handleCallStatus);
      } catch (error) {
        console.error('取消订阅通话状态更新失败:', error);
      }
    };
  }, [callActive, callData, callHistory]); // 依赖callActive和callData以获取最新状态

  // 添加安全处理函数：遮蔽电话号码
  const maskPhoneNumber = (phone: string): string => {
    if (!phone || phone.length < 7) return "***";
    
    if (phone.length === 11) {
      // 11位手机号码通常是: 138****8888
      return `${phone.substring(0, 3)}****${phone.substring(7)}`;
    } else {
      // 其他格式统一处理
      const visibleLength = Math.min(3, Math.floor(phone.length / 3));
      return `${phone.substring(0, visibleLength)}${'*'.repeat(phone.length - visibleLength * 2)}${phone.substring(phone.length - visibleLength)}`;
    }
  };

  // 修改handleCall函数，增强安全性
  const handleCall = async (number: string) => {
    if (!number || number.trim() === '') {
      return;
    }
    
    // 检查是否有短时间内的重复拨打
    if (throttleFlag.current) {
      console.log('短时间内重复点击拨打按钮，忽略本次调用');
      return;
    }
    
    // 检查是否已经有活跃通话
    if (callActive && callData?.callId) {
      console.log('已有活跃通话，忽略新的拨打请求');
      return;
    }
    
    // 设置节流标记
    throttleFlag.current = true;
    
    // 5秒后重置节流标记
    setTimeout(() => {
      throttleFlag.current = false;
    }, 5000);
    
    try {
      // 先更新UI状态
      setPhoneNumber(number);
      
      // 安全日志 - 隐藏完整电话号码
      const safePhone = maskPhoneNumber(number);
      console.log(`开始拨打电话: ${safePhone}`);
      
      // 尝试获取归属地信息
      let locationInfo = "";
      try {
        locationInfo = await getPhoneLocation(number);
      } catch (error) {
        console.error('获取归属地信息失败');
      }
      
      // 发起通话请求
      const response = await CallService.initiateCall(number);
      
      if (response && response.callId) {
        // 安全日志
        const safeCallId = response.callId.substring(0, 4) + '***';
        console.log(`拨打成功，ID: ${safeCallId}`);
        
        // 更新callData前，确保之前的callData被清理
        if (callData?.callId && callData.callId !== response.callId) {
          console.log('清理之前的通话状态');
        }
        
        setCallData(response);
        setCallActive(true);
        
        // 不要在这里添加记录，记录会由服务器生成并通过socket推送
      }
    } catch (error) {
      console.error('拨打电话失败');
      // 如果拨打失败，也不直接添加记录
      throttleFlag.current = false; // 立即重置节流标记
    }
  };

  // 处理挂断电话 - 修改以确保重置所有状态并增强安全性
  const handleHangup = () => {
    if (!callActive) {
      console.log('没有活跃通话，无需挂断');
      return;
    }
    
    setCallActive(false);
    setHeaderVisible(true); // 恢复导航头部
    
    // 其他挂断逻辑保持不变
    if (callData?.callId) {
      // 安全日志
      const safeCallId = callData.callId.substring(0, 4) + '***';
      
      // 将通话ID标记为已处理，防止通话状态监听器再次处理
      processedHangupCallIds.current.add(callData.callId);
      
      console.log(`手动挂断通话: ${safeCallId}`);
      CallService.hangupCall(callData.callId)
        .catch(error => console.error('挂断电话失败'));
        
      // 60秒后清除，允许将来再使用相同ID
      setTimeout(() => {
        processedHangupCallIds.current.delete(callData.callId);
      }, 60000);
    }
    
    // 重置状态，确保下次可以正常显示号码
    setPhoneNumber('');
    setDialPadVisible(false);
    setCallData(null);
    
    // 确保重置拨号状态
    console.log('通话结束，重置所有拨号状态');
  };

  // 移除本地存储，改为每次从服务器获取
  const loadCallHistory = async () => {
    try {
      // 尝试从服务器获取记录
      console.log('尝试从服务器直接加载记录');
      const records = await CallService.getUniqueCallRecords();
      
      if (records && records.length > 0) {
        // 转换服务器记录格式
        const processedRecords = records.map(record => {
          return {
            id: record.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            name: '',
            number: record.number,
            date: formatDate(new Date(record.date)),
            type: record.type as 'outgoing' | 'incoming' | 'missed'
          } as CallItem;
        });
        
        setCallHistory(processedRecords);
        console.log(`已加载 ${processedRecords.length} 条记录`);
      } else {
        // 如果服务器没有记录，清空本地记录
        console.log('服务器上没有记录，清空本地记录');
        setCallHistory([]);
      }
    } catch (error) {
      console.error('加载通话记录失败:', error);
      // 出错时设置为空数组
      setCallHistory([]);
    }
  };

  // 修改为直接同步到服务器而不保存本地
  const saveCallHistory = async (history: CallItem[]) => {
    try {
      // 直接同步到服务器
      console.log('同步记录到服务器...');
      await CallService.syncCallRecords(history);
    } catch (error) {
      console.error('同步通话记录到服务器失败:', error);
    }
  };

  // 修改添加通话记录的逻辑，防止重复添加并立即同步到服务器
  const addCallRecord = async (number: string, type: 'outgoing' | 'incoming' | 'missed') => {
    // 检查号码是否有效
    if (!number || number.trim() === '') {
      console.log('拒绝添加空电话号码记录');
      return;
    }
    
    console.log('添加通话记录:', number, type);
    
    // 生成真正唯一的ID（时间戳+随机数）
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    const newCall: CallItem = {
      id: uniqueId,
      name: '', // 可以从联系人列表中查找名称
      number,
      date: formatDate(new Date()),
      type,
    };

    // 使用函数式更新确保最新状态
    setCallHistory(prevHistory => {
      // 检查是否存在完全相同的记录（5秒内的相同号码）
      const isDuplicate = prevHistory.some(
        item => item.number === number &&
        Math.abs(parseDate(item.date).getTime() - Date.now()) < 5000
      );

      if (isDuplicate) {
        console.log('跳过添加重复通话记录');
        return prevHistory;
      }

      const updated = [newCall, ...prevHistory];
      
      // 立即同步到服务器
      setTimeout(() => {
        CallService.syncCallRecords(updated)
          .then(serverRecords => {
            console.log('通话记录已同步至服务器，返回了', serverRecords.length, '条记录');
            // 如果服务器返回的记录与本地不同，更新本地记录
            if (serverRecords.length > 0) {
              setCallHistory(current => {
                const merged = mergeWithServerRecords(current, serverRecords);
                return merged;
              });
            }
          })
          .catch(err => console.error('同步通话记录失败:', err));
      }, 500);
      
      return updated;
    });
  };

  // 添加辅助函数合并服务器记录
  const mergeWithServerRecords = (localRecords: CallItem[], serverRecords: any[]): CallItem[] => {
    // 创建ID映射以检测重复
    const idMap = new Map<string, boolean>();
    localRecords.forEach(record => idMap.set(record.id, true));
    
    // 转换服务器记录为客户端格式并添加不重复的记录
    const newRecords = serverRecords
      .filter(sr => !idMap.has(sr.id))
      .map(sr => {
        // 确定记录类型
        let recordType: 'outgoing' | 'incoming' | 'missed' = 'missed';
        if (sr.status === '已拨打') recordType = 'outgoing';
        else if (sr.status === '已接听') recordType = 'incoming';
        
        return {
          id: sr.id,
          name: '',
          number: sr.phoneNumber,
          date: formatDate(new Date(sr.timestamp)),
          type: recordType
        } as CallItem;
      });
    
    // 合并并排序
    return [...localRecords, ...newRecords].sort(
      (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime()
    );
  };

  // 添加辅助函数解析日期字符串
  const parseDate = (dateStr: string): Date => {
    const now = new Date();
    
    if (dateStr.includes('分钟前')) {
      const minutes = parseInt(dateStr.split('分钟前')[0]);
      return new Date(now.getTime() - minutes * 60 * 1000);
    } else if (dateStr.includes('今天')) {
      const timePart = dateStr.split('今天 ')[1];
      const [hours, minutes] = timePart.split(':').map(Number);
      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);
      return result;
    } else if (dateStr.includes('天前')) {
      const days = parseInt(dateStr.split('天前')[0]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    
    // 默认返回当前时间
    return now;
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (date >= yesterday) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  };

  // 过滤通话记录
  const filteredCalls = activeTab === 'all' 
    ? callHistory 
    : callHistory.filter(call => call.type === 'missed');

  // 处理按键输入 - 修改以确保号码正确显示
  const handleKeyPress = (key: string) => {
    if (key === 'call') {
      // 这里直接调用了handleCall，但没有防止多次快速点击
      handleCall(phoneNumber);
      return;
    }
    
    // 添加日志调试
    console.log('按下键:', key);
    
    // 如果拨号盘没有显示，确保它显示出来
    if (!dialPadVisible) {
      toggleDialPad(true);
    }
    
    // 使用函数式更新确保状态正确更新
    setPhoneNumber(prev => {
      const newNumber = prev + key;
      console.log('新号码:', newNumber);
      return newNumber;
    });
    
    // 添加触觉反馈
    if (Platform.OS === 'ios') {
      ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
    }
  };

  // 处理删除按键
  const handleDelete = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  // 长按删除全部
  const handleLongDelete = () => {
    setPhoneNumber('');
  };

  // 处理点击通话记录
  const handleCallHistoryPress = (item: CallItem) => {
    setPhoneNumber(item.number);
    setDialPadVisible(true);
  };

  // 清空通话记录
  const clearCallHistory = async () => {
    try {
      console.log('开始清空所有通话记录...');
      
      // 清空本地状态
      setCallHistory([]);
      console.log('本地通话记录已清空');
      
      // 调用服务方法清空服务器记录
      const success = await CallService.clearCallRecords();
      
      if (success) {
        console.log('服务器通话记录已全部清空，清空结果:', success);
        // 重置最后同步时间
        setLastSyncTime(null);
        
        // 触发震动反馈
        if (Platform.OS === 'ios') {
          ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        console.error('清空服务器记录失败，尝试直接调用API');
        // 尝试直接调用API
        try {
          const response = await fetch(`${API_URL}/api/clear-history`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log('直接调用API清空服务器记录成功');
          } else {
            console.error('直接调用API清空服务器记录也失败了');
          }
        } catch (error) {
          console.error('直接调用清空API出错:', error);
        }
      }
    } catch (error) {
      console.error('清空通话记录失败:', error);
    }
  };

  // 修改显示/隐藏拨号盘的函数
  const toggleDialPad = (show: boolean) => {
    console.log(`切换拨号盘显示状态: ${show ? '显示' : '隐藏'}`);
    
    // 如果是隐藏，确保关闭键盘
    if (!show) {
      Keyboard.dismiss();
    }
    
    setDialPadVisible(show);
    
    // 如果显示拨号盘但号码为空，确保拨号盘显示正常
    if (show && !phoneNumber) {
      console.log('打开拨号盘，准备接收输入...');
    }
    
    // 使用更平滑的动画效果
    Animated.spring(slideAnim, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
      overshootClamping: false,
    }).start(() => {
      // 动画完成后，如果是隐藏操作，确保状态完全重置
      if (!show) {
        console.log('拨号盘隐藏动画完成');
      }
    });
  };

  // 格式化电话号码显示
  const formatPhoneNumberDisplay = (number: string) => {
    if (number.length <= 3) return number;
    if (number.length <= 7) return `${number.slice(0, 3)} ${number.slice(3)}`;
    return `${number.slice(0, 3)} ${number.slice(3, 7)} ${number.slice(7)}`;
  };

  // 修改renderDialPad函数，更接近提供的图片样式
  const renderDialPad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#']
    ];
    
    const keyLabels: Record<string, string> = {
      '1': '',
      '2': 'ABC',
      '3': 'DEF',
      '4': 'GHI',
      '5': 'JKL',
      '6': 'MNO',
      '7': 'PQRS',
      '8': 'TUV',
      '9': 'WXYZ',
      '*': '(P)',
      '0': '+',
      '#': '(W)'
    };
    
    return (
      <>
        {/* 输入的号码显示在屏幕顶部但不遮挡标签和列表 */}
        {dialPadVisible && (
          <View style={[styles.phoneDisplayArea, { 
            top: phoneNumber.length > 0 ? 90 : 60 // 有号码时位置稍微下移，避开标签
          }]}>
            <Text style={styles.phoneNumberLarge}>
              {formatPhoneNumberDisplay(phoneNumber)}
            </Text>
            {phoneNumber.length > 0 && (
              <Text style={styles.phoneLocationText}>
                {currentLocation || ""}
              </Text>
            )}
          </View>
        )}

        {/* 在拨号盘显示时添加一个透明背景层，点击时收起键盘 */}
        {dialPadVisible && (
          <TouchableOpacity 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent', // 透明背景
              zIndex: 50 // 确保在其他UI元素上方，但在拨号盘下方
            }}
            activeOpacity={1}
            onPress={() => {
              console.log('点击背景，收起拨号盘');
              toggleDialPad(false);
              // 关闭键盘如果有的话
              Keyboard.dismiss();
            }}
          />
        )}

        {/* 拨号盘 */}
        <Animated.View 
          style={[
            styles.dialPadContainer,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height * 0.4, 0]
                })
              }],
              opacity: slideAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.5, 1]
              }),
              height: height * 0.38,
              borderTopLeftRadius: 13,
              borderTopRightRadius: 13,
              overflow: 'hidden',
              zIndex: 100 // 确保拨号盘在点击层之上
            }
          ]}
        >
          <TouchableOpacity 
            activeOpacity={1} // 确保点击拨号盘本身不会穿透到下面的透明层
            style={{ flex: 1 }}
          >
            <View style={styles.keypadWrapper}>
              <View style={styles.keypadContainer}>
                {keys.map((row, rowIndex) => (
                  <View key={`keypad-row-${rowIndex}`} style={styles.keyRow}>
                    {row.map((key, keyIndex) => (
                      <TouchableOpacity
                        key={`key-${rowIndex}-${keyIndex}-${key}`}
                        style={styles.keyButton}
                        onPress={() => handleKeyPress(key)}
                      >
                        <Text style={styles.keyText}>{key}</Text>
                        {keyLabels[key] && (
                          <Text style={styles.keySubText}>
                            {keyLabels[key]}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={styles.sideButton}
                onPress={() => toggleDialPad(false)}
              >
                <Ionicons name="keypad" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.callButton, !phoneNumber.length && { opacity: 0.5 }]}
                onPress={phoneNumber.length > 0 ? () => handleCall(phoneNumber) : undefined}
              >
                <View style={styles.callButtonInner}>
                  <Ionicons name="call" size={24} color="white" />
                  <Text style={styles.hdText}>HD</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.sideButton}
                onPress={handleDelete}
                onLongPress={handleLongDelete}
              >
                <Ionicons name="backspace-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </>
    );
  };

  // 2. 修改FlatList的renderItem属性
  const handleCallItemPress = (item: CallItem) => {
    setPhoneNumber(item.number);
    setTimeout(() => {
      handleCall(item.number);
    }, 100);
  };

  // 辅助函数：获取通话类型图标
  const getCallTypeIcon = (type: 'outgoing' | 'incoming' | 'missed') => {
    switch (type) {
      case 'outgoing': return 'arrow-up-outline' as const;
      case 'incoming': return 'arrow-down-outline' as const;
      case 'missed': return 'close-outline' as const;
      default: return 'call-outline' as const;
    }
  };

  // 修改定期同步的useEffect，只保留初始同步，删除定时器
  useEffect(() => {
    // 首次加载时执行一次同步
    const initialSync = async () => {
      try {
        console.log('应用启动时执行自动同步...');
        await autoSyncWithServer();
      } catch (error) {
        console.error('初始同步失败:', error);
      }
    };
    
    initialSync();
  }, []);
  
  // 自动同步功能 - 修改为强制同步
  const autoSyncWithServer = async () => {
    try {
      // 检查是否有网络连接
      const isConnected = await CallService.checkConnection();
      if (!isConnected) {
        console.log('无法连接到服务器，跳过自动同步');
        return;
      }
      
      console.log('执行强制自动同步...');
      setIsSyncing(true);
      
      // 不再使用本地存储的同步时间
      console.log('直接从服务器获取所有记录');
      
      // 直接使用去重方法获取记录
      const uniqueRecords = await CallService.getUniqueCallRecords();
      console.log(`获取到 ${uniqueRecords.length} 条去重后的记录`);
      
      if (uniqueRecords.length > 0) {
        // 转换服务器记录格式
        const processedRecords = uniqueRecords.map(record => {
          return {
            id: record.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            name: '',
            number: record.number,
            date: formatDate(new Date(record.date)),
            type: record.type as 'outgoing' | 'incoming' | 'missed'
          } as CallItem;
        });
        
        // 替换本地记录
        setCallHistory(processedRecords);
        // 不再保存到本地存储
        
        console.log(`自动同步完成，获取了 ${processedRecords.length} 条记录`);
      } else {
        // 如果服务器上没有记录，清空本地记录
        console.log('服务器上没有记录，清空本地记录');
        setCallHistory([]);
      }
    } catch (error) {
      console.error('自动同步失败:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // 定义菜单项
  const menuItems: MenuItem[] = [
    {
      id: 'paste',
      label: '粘贴',
      icon: 'copy-outline'
    },
    {
      id: 'record',
      label: '通话录音',
      icon: 'mic-outline'
    },
    {
      id: 'delete',
      label: '批量删除',
      icon: 'trash-outline'
    },
    {
      id: 'intercept',
      label: '强制拦截',
      icon: 'shield-outline'
    },
    {
      id: 'settings',
      label: '设置',
      icon: 'settings-outline'
    }
  ];
  
  // 处理菜单项点击
  const handleMenuItemPress = (id: string) => {
    setMenuVisible(false);
    
    switch (id) {
      case 'paste':
        pastePhoneNumber();
        break;
      case 'record':
        console.log('通话录音功能不可用');
        break;
      case 'delete':
        confirmClearCallHistory();
        break;
      case 'intercept':
        console.log('强制拦截功能不可用');
        break;
      case 'settings':
        console.log('设置功能不可用');
        break;
      default:
        break;
    }
  };

  // 添加以下代码：当标签页获取焦点时重置拨号盘状态
  useFocusEffect(
    useCallback(() => {
      // 当页面重新获得焦点时，重置为默认视图
      setDialPadVisible(false);
      
      // 如果当前有通话，不重置电话号码
      if (!callActive) {
        setPhoneNumber('');
      }
      
      // 确保导航栏显示
      setHeaderVisible(true);
      
      return () => {
        // 清理函数（如果需要）
      };
    }, [callActive])
  );

  // 在组件加载时检查服务器状态
  useEffect(() => {
    const checkServer = async () => {
      setCheckingServer(true);
      try {
        // 尝试3次
        for (let i = 0; i < 3; i++) {
          try {
            console.log(`检查服务器状态 (尝试 ${i+1}/3)...`);
            const response = await fetch(`${API_URL}/api/status`, {
              method: 'GET',
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (response.ok) {
              console.log('服务器状态正常');
              setServerAwake(true);
              break;
            }
          } catch (error) {
            console.log(`服务器检查失败 (尝试 ${i+1})`, error);
            
            // 最后一次尝试失败时
            if (i === 2) {
              console.log('所有服务器检查尝试失败');
              setServerAwake(false);
              
              // 自动尝试一次唤醒
              setTimeout(() => {
                // 静默尝试唤醒，不显示UI提示
                console.log('自动尝试唤醒服务器...');
                fetch(`${API_URL}/api/status`, {
                  method: 'GET',
                  headers: { 'Cache-Control': 'no-cache' }
                }).catch(() => console.log('自动唤醒尝试失败'));
              }, 2000);
            }
          }
          
          // 等待1秒再尝试
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.error('检查服务器状态时出错:', error);
        setServerAwake(false);
      } finally {
        setCheckingServer(false);
      }
    };
    
    checkServer();
  }, []);

  // 检查电话号码归属地查询正常工作
  useEffect(() => {
    const testPhoneLocation = async () => {
      try {
        const location = await getPhoneLocation('13800138000');
        console.log('测试电话号码归属地:', location);
      } catch (error) {
        console.error('测试归属地查询失败:', error);
      }
    };
    
    testPhoneLocation();
  }, []);

  // 在电话键盘输入号码时显示归属地
  useEffect(() => {
    let isMounted = true;
    
    const updatePhoneLocation = async () => {
      if (phoneNumber.length >= 7) {
        // 不显示任何加载状态，仅在最终结果出来后显示
        try {
          const location = await getPhoneLocation(phoneNumber);
          if (isMounted) {
            setCurrentLocation(location);
          }
        } catch (error) {
          if (isMounted) {
            setCurrentLocation(""); // 出错时不显示任何内容
          }
        }
      } else {
        setCurrentLocation("");
      }
    };
    
    updatePhoneLocation();
    
    return () => {
      isMounted = false;
    };
  }, [phoneNumber]);

  // 辅助函数检查时间是否在指定秒数内
  const isWithinLastSeconds = (date: Date, seconds: number): boolean => {
    const now = new Date();
    return (now.getTime() - date.getTime()) / 1000 < seconds;
  };

  // 手动触发同步
  const handleManualSync = async () => {
    if (isSyncing) return; // 避免重复触发
    
    try {
      setIsSyncing(true);
      console.log('手动触发同步...');
      
      // 检查是否有网络连接
      const isConnected = await CallService.checkConnection();
      if (!isConnected) {
        console.log('无法连接到服务器，同步失败');
        return;
      }
      
      // 获取服务器记录
      const serverRecords = await CallService.getCallRecords();
      
      if (serverRecords && serverRecords.length > 0) {
        console.log(`从服务器获取了 ${serverRecords.length} 条通话记录`);
        mergeServerRecords(serverRecords);
        
        // 同步本地记录到服务器
        await CallService.syncCallRecords(callHistory);
        
        // 更新最后同步时间
        setLastSyncTime(new Date());
        
        // 触发震动反馈 - 使用ExpoHaptics替代
        if (Platform.OS === 'ios') {
          ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
        }
        
        console.log('同步完成');
      }
    } catch (error) {
      console.error('手动同步失败:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // 保留checkServerConnection函数，因为在其他地方还会用到它
  const checkServerConnection = async () => {
    try {
      setCheckingServer(true);
      const isConnected = await CallService.checkConnection();
      setServerAwake(isConnected);
      
      // 显示结果，但现在用不到了
      setCheckingServer(false);
    } catch (error) {
      console.error('检查服务器状态时出错:', error);
      setServerAwake(false);
      setCheckingServer(false);
    }
  };

  // 从剪贴板粘贴电话号码
  const pastePhoneNumber = async () => {
    try {
      // 使用Clipboard API获取剪贴板内容
      const content = await Clipboard.getStringAsync();
      
      // 检查是否是有效的电话号码（简单验证）
      const phoneRegex = /^1\d{10}$|^\d{3,4}-\d{7,8}$|^\d{7,11}$/;
      
      if (content && phoneRegex.test(content.trim())) {
        // 设置电话号码（去除空格）
        const cleanNumber = content.trim().replace(/\s+/g, '');
        setPhoneNumber(cleanNumber);
        
        // 显示拨号盘
        toggleDialPad(true);
        
        // 给予用户反馈
        if (Platform.OS === 'ios') {
          ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
        }
      } else {
        console.log('剪贴板中没有有效的电话号码');
      }
    } catch (error) {
      console.error('从剪贴板粘贴电话号码失败:', error);
    }
  };
  
  // 确认清空通话记录
  const confirmClearCallHistory = () => {
    // 直接调用清空方法，不再询问确认
    clearCallHistory();
  };

  // 修改手动唤醒服务器函数，移除弹窗
  const wakeupServer = async () => {
    if (checkingServer) return;
    
    try {
      setCheckingServer(true);
      console.log('开始唤醒服务器...');
      
      // 先做一个简单的状态检查请求
      const statusCheck = await fetch(`${API_URL}/api/status`, { 
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => null);
      
      if (statusCheck && statusCheck.ok) {
        console.log('服务器已经在线，无需唤醒');
        setServerAwake(true);
        return;
      }
      
      // 执行多次请求唤醒服务器
      let success = false;
      for (let i = 0; i < 5; i++) {
        console.log(`唤醒尝试 ${i+1}/5...`);
        
        try {
          const response = await fetch(`${API_URL}/api/status`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (response.ok) {
            console.log('服务器已唤醒！');
            success = true;
            break;
          }
        } catch (error) {
          console.log(`尝试 ${i+1} 失败，等待重试...`);
        }
        
        // 等待6秒后再尝试
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
      
      if (success) {
        setServerAwake(true);
        console.log('服务器已成功唤醒，现在开始重新加载记录');
        
        // 自动尝试重新加载记录
        setTimeout(() => {
          forceReloadFromServer().catch(err => console.error('重新加载记录失败:', err));
        }, 3000);
      } else {
        console.log('唤醒服务器失败，可能处于维护状态');
      }
    } catch (error) {
      console.error('唤醒服务器出错:', error);
    } finally {
      setCheckingServer(false);
    }
  };

  // 为整个应用添加点击处理以关闭拨号盘
  useEffect(() => {
    // 添加触摸事件监听器以关闭拨号盘
    const handleTouchEnd = (event: any) => {
      // 仅当拨号盘显示且不在通话中时处理
      if (dialPadVisible && !callActive) {
        // 这里的逻辑在TouchableOpacity中处理，这是额外的保障
        // 大部分情况下通过透明背景层的onPress已经能处理
      }
    };

    // 实际环境中不需要进行事件监听，透明背景层已足够
    // 这里保留代码仅作参考，实际不执行
    
    return () => {
      // 清理函数
    };
  }, [dialPadVisible, callActive]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '电话',
          headerStyle: {
            backgroundColor: '#000000', // 始终使用黑色背景，不再根据isDark变化
          },
          headerTitleStyle: {
            color: '#FFFFFF', // 标题始终为白色
            fontSize: 20,
            fontWeight: 'bold',
          },
          headerRight: () => (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => setMenuVisible(!menuVisible)}
                hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
              >
                <FourDots />
              </TouchableOpacity>
            </View>
          ),
          headerLeft: () => null,
        }}
      />
      
      <ThemedView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        {menuVisible && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity 
              style={styles.menuBackground}
              onPress={() => setMenuVisible(false)}
            />
            <View style={[
              styles.menuContainer,
              { backgroundColor: '#1C1C1E' }
            ]}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={`menu-item-${item.id}-${index}`}
                  style={[
                    styles.menuItem,
                    index > 0 && styles.menuItemBorder
                  ]}
                  onPress={() => handleMenuItemPress(item.id)}
                >
                  <ThemedText style={styles.menuItemText}>
                    {item.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        {(!dialPadVisible || (dialPadVisible && phoneNumber.length === 0)) && (
          <>
            <View style={[styles.tabContainer, { backgroundColor: '#000000' }]}>
              <View style={[styles.tabWrapper, { backgroundColor: '#000000' }]}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'all' && styles.activeTab
                  ]}
                  onPress={() => setActiveTab('all')}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'all' ? '#007AFF' : '#999999' }
                  ]}>全部通话</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'missed' && styles.activeTab
                  ]}
                  onPress={() => setActiveTab('missed')}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'missed' ? '#007AFF' : '#999999' }
                  ]}>未接通话</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <FlatList
              data={filteredCalls}
              renderItem={({ item }) => (
                <CallItemComponent 
                  item={item} 
                  onPress={handleCallItemPress} 
                  handleCall={handleCall} 
                />
              )}
              keyExtractor={(item, index) => `call-item-${item.id}-${index}`}
              style={[styles.callList, { backgroundColor: '#000000' }]}
              contentContainerStyle={{ 
                paddingBottom: dialPadVisible ? height * 0.4 + 20 : 100
              }}
            />
          </>
        )}
        
        {!dialPadVisible && (
          <TouchableOpacity 
            style={styles.dialButton}
            onPress={() => toggleDialPad(true)}
          >
            <Ionicons 
              name="keypad" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#007AFF'} 
            />
          </TouchableOpacity>
        )}
        
        {renderDialPad()}
        
        <Modal
          visible={callActive}
          animationType="slide"
          onRequestClose={handleHangup}
          transparent={false}
          statusBarTranslucent={true}
          presentationStyle="fullScreen"
        >
          <CallScreen 
            phoneNumber={phoneNumber}
            onHangup={handleHangup}
            callId={callData?.callId}
          />
        </Modal>
      </ThemedView>
    </>
  );
}

// 更新样式，更接近图片风格
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 44,
    marginBottom: 10, // 顶部标题栏样式
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold', // "电话"标题文本样式
  },
  menuButton: {
    padding: 10, // 右上角菜单按钮样式
  },
  menuOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000, // 菜单弹出层位置
  },
  menuBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height, // 菜单背景遮罩
  },
  menuContainer: {
    minWidth: 160,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden', // 菜单容器样式
  },
  menuItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center', // 菜单项样式
  },
  menuItemBorder: {
    borderTopWidth: 0.5,
    borderTopColor: '#333333', // 菜单项之间的边框线
  },
  menuItemText: {
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center', // 菜单项文本样式
  },
  tabContainer: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
    alignItems: 'center',
  },
  tabWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 15,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  callList: {
    flex: 1, // 通话记录列表容器
  },
  callItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
    backgroundColor: '#000000',
  },
  callInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  callName: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 4, // 通话名称/号码样式
  },
  callSubText: {
    fontSize: 12,
    color: '#8E8E93', // 通话附加信息样式
  },
  callDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 10, // 通话日期样式
  },
  callInfoButton: {
    padding: 5, // 通话信息按钮样式
  },
  dialButton: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#228B22', // 森林绿，深色
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  dialPadContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.4,
    backgroundColor: '#333333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  phoneDisplayArea: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 80,
    paddingTop: 10, // 增加顶部内边距
  },
  phoneNumberLarge: {
    fontSize: 36,
    fontWeight: '400',
    color: 'white',
    textAlign: 'center',
  },
  phoneLocationText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10, // 电话归属地文本样式
  },
  keypadWrapper: {
    flex: 1,
    backgroundColor: '#333333',
    justifyContent: 'center', 
    paddingBottom: 0,
    paddingTop: 20, // 从10增加到20，使内容向下移动
  },
  keypadContainer: {
    paddingHorizontal: 70, // 键盘水平内边距，使按钮更靠近中间
    paddingBottom: 0, // 键盘容器样式
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 42, // 从45减小到42
    marginBottom: 12, // 从15减小到12
  },
  keyButton: {
    width: (width - 260) / 3, // 按钮宽度，三列紧凑排列
    height: 50, // 按钮高度
    justifyContent: 'center',
    alignItems: 'center', // 键盘按钮样式
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
  },
  keySubText: {
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
    marginTop: -2, // 按钮字母文本样式
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 70,
    paddingVertical: 6, // 从8减小到6
    backgroundColor: '#333333',
    marginTop: -6, // 从-8改为-6
    marginBottom: 12, // 从15减小到12
  },
  sideButton: {
    width: (width - 260) / 3, // 与键盘按钮宽度一致
    height: 40,
    justifyContent: 'center',
    alignItems: 'center', // 侧边按钮样式
  },
  callButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CD964', // 荧光绿，亮色
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonInner: {
    alignItems: 'center', // 拨打电话按钮内部样式
  },
  hdText: {
    color: 'white',
    fontSize: 10,
    marginTop: 1,
    fontWeight: '400', // HD文本样式
  },
  deleteButtonAbsolute: {
    position: 'absolute',
    right: 20,
    top: height * 0.3 - 30,
    padding: 10,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    borderRadius: 20,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center', // 删除按钮样式
  },
  dialPadContent: {
    backgroundColor: '#333333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15, // 拨号盘内容样式
  },
  dotsContainer: {
    width: 20,  // 保持20x20的正方形容器
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    marginVertical: 1,  // 保持原有的行间距
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000000',
    margin: 1, // 单个点样式
  },
  serverSleepingBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    zIndex: 1000,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverSleepingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTime: {
    fontSize: 12,
    color: 'gray',
    marginLeft: 5,
  },
  dialPadHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  dialPadNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  nameContainer: {
    flex: 1,
  },
  callLocation: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },
  callActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callAction: {
    padding: 10,
  },
  syncButton: {
    padding: 10,
    marginLeft: 10,
  },
  syncTimeText: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 'auto',
    marginRight: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  wakeupButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  wakeupButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
