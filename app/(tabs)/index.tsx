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

// 电话号码归属地数据（模拟）
const getPhoneLocation = (phoneNumber: string) => {
  if (phoneNumber.startsWith('158')) return '浙江宁波 移动';
  if (phoneNumber.startsWith('138')) return '浙江杭州 移动';
  if (phoneNumber.startsWith('139')) return '浙江温州 移动';
  if (phoneNumber.startsWith('136')) return '浙江金华 移动';
  if (phoneNumber.startsWith('135')) return '浙江台州 移动';
  return phoneNumber.length > 6 ? '未知归属地' : '';
};

// 添加菜单选项类型
interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

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

  // 加载通话记录
  useEffect(() => {
    loadCallHistory();
  }, []);

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

  // 修改添加通话记录函数，避免重复添加
  const addCallRecord = (number: string, type: 'outgoing' | 'incoming' | 'missed') => {
    // 检查是否已经存在相同的记录（在短时间内）
    const now = new Date();
    const recentCalls = callHistory.filter(call => 
      call.number === number && 
      call.type === type && 
      new Date(call.date).getTime() > now.getTime() - 10000 // 10秒内的记录视为重复
    );
    
    if (recentCalls.length > 0) {
      // 已存在最近的相同记录，不再添加
      return;
    }
    
    const newCall: CallItem = {
      id: Date.now().toString(),
      name: '', // 可以从联系人列表中查找名称
      number,
      date: formatDate(new Date()),
      type,
    };

    const updatedHistory = [newCall, ...callHistory];
    setCallHistory(updatedHistory);
    saveCallHistory(updatedHistory);
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

  // 修改通话状态监听器，确保不会丢失之前的通话记录
  useEffect(() => {
    const unsubscribe = CallService.addListener((data: CallStatusData) => {
      console.log('Call status update:', data);
      
      if (data.status === 'ended' && data.phoneNumber) {
        // 通话结束时添加记录，不会覆盖现有记录
        addCallRecord(data.phoneNumber, 'outgoing');
        setCallActive(false);
      } else if (data.status === 'ringing' && data.phoneNumber) {
        // 来电时添加记录
        addCallRecord(data.phoneNumber, 'incoming');
      }
    });

    return () => { unsubscribe(); };
  }, []); // 移除 callHistory 依赖

  // 过滤通话记录
  const filteredCalls = activeTab === 'all' 
    ? callHistory 
    : callHistory.filter(call => call.type === 'missed');

  // 处理按键输入
  const handleKeyPress = (key: string) => {
    setPhoneNumber(prev => prev + key);
  };

  // 处理删除按键
  const handleDelete = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  // 长按删除全部
  const handleLongDelete = () => {
    setPhoneNumber('');
  };

  // 处理拨打电话
  const handleCall = async () => {
    if (!phoneNumber) return;
    
    setHeaderVisible(false); // 隐藏导航头部
    
    try {
      const response = await CallService.makeCall(phoneNumber);
      if (response && response.callId) {
        setCallData(response);
        setCallActive(true);
      }
    } catch (error) {
      console.error('拨打电话失败:', error);
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
    
    // 添加到通话记录
    if (phoneNumber) {
      addCallRecord(phoneNumber, 'outgoing');
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
                {getPhoneLocation(phoneNumber)}
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
                  <View key={`row-${rowIndex}`} style={styles.keyRow}>
                    {row.map(key => (
                      <TouchableOpacity
                        key={key}
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
                onPress={phoneNumber.length > 0 ? handleCall : undefined}
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

  // 修改renderCallItem函数以匹配图片风格
  const renderCallItem = ({ item }: { item: CallItem }) => {
    const getCallTypeIcon = (type: 'outgoing' | 'incoming' | 'missed') => {
      switch (type) {
        case 'outgoing': return 'arrow-up-outline' as const;
        case 'incoming': return 'arrow-down-outline' as const;
        case 'missed': return 'close-outline' as const;
        default: return 'call-outline' as const;
      }
    };
    
    return (
      <TouchableOpacity 
        style={[styles.callItem, { backgroundColor: '#000000' }]}
        onPress={() => handleCallHistoryPress(item)}
      >
        <View style={{flexDirection: 'row', flex: 1, alignItems: 'center'}}>
          <Ionicons name="call-outline" size={20} color="#999999" style={{marginRight: 12}} />
          <View style={styles.callInfo}>
            <ThemedText style={styles.callName}>
              {item.name || item.number}
            </ThemedText>
            <ThemedText style={styles.callSubText}>未知</ThemedText>
          </View>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <ThemedText style={styles.callDate}>{item.date}</ThemedText>
          <TouchableOpacity style={styles.callInfoButton}>
            <Ionicons name="information-circle-outline" size={24} color="#999999" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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
        // 处理离线模式切换
        setIsOfflineMode(!isOfflineMode);
        // 通知CallService切换模式
        CallService.setOfflineMode(!isOfflineMode);
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
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
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
            <View style={[
              styles.tabContainer, 
              { borderBottomColor: '#333333' }
            ]}>
              <View style={styles.tabWrapper}>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'all' && styles.activeTab]}
                  onPress={() => setActiveTab('all')}
                >
                  <ThemedText style={[
                    styles.tabText,
                    activeTab === 'all' && { color: '#007AFF' }
                  ]}>全部通话</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'missed' && styles.activeTab]}
                  onPress={() => setActiveTab('missed')}
                >
                  <ThemedText style={[
                    styles.tabText,
                    activeTab === 'missed' && { color: '#007AFF' }
                  ]}>未接通话</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
            
            <FlatList
              data={filteredCalls}
              renderItem={renderCallItem}
              keyExtractor={item => item.id}
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
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 20,
    backgroundColor: '#000000',
  },
  tabWrapper: {
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center', // 添加居中
    alignItems: 'center',
  },
  tab: {
    paddingVertical: 10, // 稍微减少垂直内边距
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center', // 确保内容居中
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF', // 激活标签样式
  },
  tabText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  callList: {
    flex: 1, // 通话记录列表容器
  },
  callItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
    alignItems: 'center',
    justifyContent: 'space-between', // 通话记录项样式
    backgroundColor: '#000000',
  },
  callInfo: {
    flex: 1, // 通话信息容器
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
});
