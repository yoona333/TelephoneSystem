import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, FlatList, Dimensions, StatusBar, Modal, SafeAreaView, Platform, Animated } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CallScreen from '@/components/CallScreen';
import CallService from '@/services/CallService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/services/CallService';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Haptics } from '@/utils/Haptics';
import { getPhoneLocation } from '@/services/PhoneLocationService';
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

  // 加载通话记录
  useEffect(() => {
    loadCallHistory();
    
    // 从服务器加载通话记录并合并
    const loadServerRecords = async () => {
      try {
        console.log('尝试从服务器获取通话记录...');
        const serverRecords = await CallService.getCallRecords();
        
        // 如果获取到记录，合并到本地
        if (serverRecords && serverRecords.length > 0) {
          console.log(`从服务器获取了 ${serverRecords.length} 条通话记录`);
          mergeServerRecords(serverRecords);
        }
      } catch (error) {
        console.error('加载服务器通话记录失败:', error);
      }
    };
    
    loadServerRecords();
    
    // 添加Socket.IO事件监听，实时更新通话记录
    const handleCallRecordUpdate = (record: any) => {
      if (!record) {
        console.log('收到无效的通话记录更新');
        return;
      }
      
      console.log('收到服务器通话记录更新:', record);
      
      // 确定记录类型
      let recordType: 'outgoing' | 'incoming' | 'missed';
      
      if (record.status === '已拨打') {
        recordType = 'outgoing';
      } else if (record.status === '已接听') {
        recordType = 'incoming';
      } else {
        recordType = 'missed';
      }
      
      // 转换为本地记录格式
      const localRecord: CallItem = {
        id: record.id ? record.id.toString() : Date.now().toString(),
        name: '',
        number: record.phoneNumber || '',
        date: formatDate(new Date(record.timestamp || Date.now())),
        type: recordType
      };
      
      // 添加到本地记录
      addNewCallRecord(localRecord);
    };
    
    // 订阅通话记录更新
    try {
      CallService.subscribeToCallRecords(handleCallRecordUpdate);
    } catch (error) {
      console.error('订阅通话记录更新失败:', error);
    }
    
    // 定期同步记录（每5分钟同步一次）
    const syncInterval = setInterval(() => {
      try {
        syncRecordsWithServer();
      } catch (error) {
        console.error('定期同步记录失败:', error);
      }
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(syncInterval);
      try {
        CallService.unsubscribeFromCallRecords(handleCallRecordUpdate);
      } catch (error) {
        console.error('取消订阅通话记录更新失败:', error);
      }
    };
  }, []);
  
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
    setCallHistory(prevHistory => {
      // 检查是否已存在相同号码和时间（5分钟内）的记录
      const isDuplicate = prevHistory.some(existing => 
        existing.number === record.number &&
        Math.abs(parseDate(existing.date).getTime() - parseDate(record.date).getTime()) < 5 * 60 * 1000
      );
      
      if (isDuplicate) {
        console.log('跳过添加重复记录:', record.number);
        return prevHistory;
      }
      
      // 添加新记录并排序
      const updated = [record, ...prevHistory].sort((a, b) => 
        parseDate(b.date).getTime() - parseDate(a.date).getTime()
      );
      
      // 保存到本地存储
      saveCallHistory(updated);
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
        console.log('通话记录同步成功');
        
        // 获取最新的服务器记录并更新本地
        const serverRecords = await CallService.getCallRecords();
        if (serverRecords && serverRecords.length > 0) {
          mergeServerRecords(serverRecords);
        }
      }
    } catch (error) {
      console.error('同步通话记录失败:', error);
    }
  };

  // 在通话结束后同步记录
  useEffect(() => {
    const handleCallStatus = (data: any) => {
      if (!data) return;
      
      // 只在通话结束时处理
      if (data.status === 'ended' && data.phoneNumber) {
        // 延迟2秒再同步，确保服务器有时间保存记录
        setTimeout(() => {
          try {
            syncRecordsWithServer();
          } catch (error) {
            console.error('通话结束后同步记录失败:', error);
          }
        }, 2000);
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
  }, [callHistory]);

  // 从 AsyncStorage 加载通话记录
  const loadCallHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(CALL_HISTORY_STORAGE_KEY);
      if (storedHistory) {
        setCallHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('加载通话记录失败:', error);
    }
  };

  // 保存通话记录到 AsyncStorage
  const saveCallHistory = async (history: CallItem[]) => {
    try {
      await AsyncStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('保存通话记录失败:', error);
    }
  };

  // 修改添加通话记录的逻辑，防止重复添加
  const addCallRecord = (number: string, type: 'outgoing' | 'incoming' | 'missed') => {
    // 检查号码是否有效
    if (!number || number.trim() === '') {
      console.log('拒绝添加空电话号码记录');
      return;
    }
    
    console.log('添加通话记录:', number, type);
    
    const newCall: CallItem = {
      id: Date.now().toString(),
      name: '', // 可以从联系人列表中查找名称
      number,
      date: formatDate(new Date()),
      type,
    };

    // 使用函数式更新确保最新状态
    setCallHistory(prevHistory => {
      // 检查是否已经存在相同号码且时间接近的记录（30秒内）
      const now = new Date();
      const recentCall = prevHistory.find(call => {
        // 检查号码是否相同
        if (call.number !== number) return false;
        
        // 检查时间是否在30秒内
        const callDate = parseDate(call.date);
        const diffSeconds = Math.abs((now.getTime() - callDate.getTime()) / 1000);
        return diffSeconds < 30;
      });
      
      // 如果已存在近期记录，不添加新记录
      if (recentCall) {
        console.log('跳过添加重复记录:', number);
        return prevHistory;
      }
      
      // 添加新记录并立即排序
      const updatedHistory = [newCall, ...prevHistory]
        .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
      
      // 保存到AsyncStorage
      saveCallHistory(updatedHistory).catch(e => 
        console.error('保存通话记录失败:', e)
      );
      
      // 尝试将记录同步到服务器
      setTimeout(() => {
        syncRecordsWithServer().catch(e => 
          console.error('同步记录到服务器失败:', e)
        );
      }, 500);
      
      return updatedHistory;
    });
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

  // 完全重写通话记录管理逻辑
  useEffect(() => {
    // 创建一个全局的已处理通话ID集合，确保每个通话只处理一次
    const processedCallIds = new Set<string>();
    
    const handleCallStatus = (data: any) => {
      console.log('通话状态更新:', data);
      
      // 只在通话结束时添加记录
      if (data.status === 'ended' && data.phoneNumber && data.callId) {
        // 检查这个通话ID是否已经处理过
        if (processedCallIds.has(data.callId)) {
          console.log('忽略已处理的通话ID:', data.callId);
          return;
        }
        
        // 标记为已处理
        processedCallIds.add(data.callId);
        
        // 检查最近30秒内是否已经有相同号码的记录
        const recentCallExists = callHistory.some(call => 
          call.number === data.phoneNumber && 
          isWithinLastSeconds(parseDate(call.date), 30)
        );
        
        if (!recentCallExists) {
          console.log('添加新通话记录:', data.phoneNumber);
          addCallRecord(data.phoneNumber, 'outgoing');
        } else {
          console.log('跳过添加重复号码记录:', data.phoneNumber);
        }
      }
    };
    
    // 添加监听器
    CallService.subscribeToCallStatus(handleCallStatus);
    
    // 清理函数
    return () => {
      CallService.unsubscribeFromCallStatus(handleCallStatus);
    };
  }, [callHistory]); // 依赖callHistory以获取最新状态

  // 过滤通话记录
  const filteredCalls = activeTab === 'all' 
    ? callHistory 
    : callHistory.filter(call => call.type === 'missed');

  // 处理按键输入
  const handleKeyPress = (key: string) => {
    if (key === 'call') {
      // 这里直接调用了handleCall，但没有防止多次快速点击
      handleCall(phoneNumber);
      return;
    }
    // 添加日志调试
    console.log('按下键:', key);
    
    // 使用函数式更新确保状态正确更新
    setPhoneNumber(prev => {
      const newNumber = prev + key;
      console.log('新号码:', newNumber);
      return newNumber;
    });
    
    // 添加触觉反馈
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  // 修改handleCall函数，改进防抖逻辑
  const handleCall = async (number: string) => {
    if (!number || number.trim() === '') {
      return;
    }
    
    try {
      // 先更新UI状态
      setPhoneNumber(number);
      console.log('开始拨打电话:', number);
      
      // 尝试获取归属地信息
      let locationInfo = "";
      try {
        locationInfo = await getPhoneLocation(number);
      } catch (error) {
        console.error('获取归属地信息失败:', error);
      }
      
      // 发起通话请求
      const response = await CallService.initiateCall(number);
      
      if (response && response.callId) {
        console.log('拨打成功，callId:', response.callId);
        setCallData(response);
        setCallActive(true);
      }
    } catch (error) {
      console.error('拨打电话失败:', error);
      // 如果拨打失败，添加未接通记录
      addCallRecord(number, 'missed');
    }
  };

  // 处理挂断电话
  const handleHangup = () => {
    setCallActive(false);
    setHeaderVisible(true); // 恢复导航头部
    
    // 其他挂断逻辑保持不变
    if (callData?.callId) {
      CallService.hangupCall(callData.callId)
        .catch(error => console.error('挂断电话失败:', error));
    }
    
    // 重置状态
    setPhoneNumber('');
    setDialPadVisible(false);
  };

  // 处理点击通话记录
  const handleCallHistoryPress = (item: CallItem) => {
    setPhoneNumber(item.number);
    setDialPadVisible(true);
  };

  // 清空通话记录
  const clearCallHistory = () => {
    setCallHistory([]);
    saveCallHistory([]);
  };

  // 修改显示/隐藏拨号盘的函数
  const toggleDialPad = (show: boolean) => {
    setDialPadVisible(show);
    Animated.spring(slideAnim, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
    }).start();
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
                {currentLocation || "查询中..."}
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
            onPress={() => toggleDialPad(false)}
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

  // 菜单选项
  const menuItems: MenuItem[] = [
    { id: 'paste', label: '粘贴', icon: 'copy-outline' },
    { id: 'record', label: '通话录音', icon: 'recording-outline' },
    { id: 'delete', label: '批量删除', icon: 'trash-outline' },
    { id: 'block', label: '骚扰拦截', icon: 'shield-outline' },
    { id: 'settings', label: '设置', icon: 'settings-outline' },
    { id: 'offline', label: '切换到离线模式', icon: 'cloud-offline' },
  ];

  // 处理菜单项点击
  const handleMenuItemPress = (id: string) => {
    setMenuVisible(false);
    switch (id) {
      case 'paste':
        // 处理粘贴
        break;
      case 'record':
        // 处理通话录音
        break;
      case 'delete':
        // 处理批量删除
        break;
      case 'block':
        // 处理骚扰拦截
        break;
      case 'settings':
        // 处理设置
        break;
      case 'offline':
        setIsOfflineMode(!isOfflineMode);
        break;
    }
  };

  // 在 PhoneScreen 组件中添加
  useEffect(() => {
    
    // 检查服务器连接
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_URL}/api/status`, {
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        setServerConnected(!!response);
      } catch (error) {
        setServerConnected(false);
        console.log('Server connection failed, using offline mode');
      }
    };
    
    checkConnection();
  }, []);

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
        const response = await fetch(`${API_URL}/api/status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        setServerAwake(response.ok);
      } catch (error) {
        console.log('服务器可能在睡眠中');
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
        setCurrentLocation(""); // 不显示"查询中..."
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

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: headerVisible,
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTitleStyle: {
            color: '#FFFFFF',
          },
          contentStyle: {
            backgroundColor: '#000000',
            paddingTop: 0
          }
        }} 
      />
      
      <ThemedView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        
        {menuVisible && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity 
              style={styles.menuBackground}
              onPress={() => setMenuVisible(false)}
            />
            <View style={[
              styles.menuContainer,
              { backgroundColor: '#000000' }
            ]}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={`menu-item-${item.id}-${index}`}
                  style={styles.menuItem}
                  onPress={() => handleMenuItemPress(item.id)}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={20} 
                    color={isDark ? '#FFFFFF' : '#000000'} 
                    style={styles.menuItemIcon}
                  />
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
            <View style={styles.tabContainer}>
              <View style={styles.tabWrapper}>
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
              keyExtractor={item => `call-item-${item.id}`}
              style={styles.callList}
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
          />
        </Modal>
        
        {/* 在UI中显示状态 */}
        {!serverAwake && (
          <View style={styles.serverSleepingBanner}>
            <Text style={styles.serverSleepingText}>
              {checkingServer ? '正在连接服务器...' : '服务器正在唤醒中，首次连接可能较慢'}
            </Text>
          </View>
        )}
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
    right: 10,
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
    minWidth: 150,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5, // 菜单容器样式
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12, // 菜单项样式
  },
  menuItemIcon: {
    marginRight: 10, // 菜单项图标样式
  },
  menuItemText: {
    fontSize: 16, // 菜单项文本样式
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    zIndex: 1000,
  },
  serverSleepingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
});
