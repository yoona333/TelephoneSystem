import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Dimensions, StatusBar, SafeAreaView, Image, AppState, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import CallService, { API_URL } from '@/services/CallService';
import io from 'socket.io-client';

const { width, height } = Dimensions.get('window');

// 使用服务中的Socket，而不是创建新的
// 不再创建新的Socket连接，改为使用服务中的

interface CallScreenProps {
  phoneNumber: string;
  onHangup: () => void;
  callId?: string; // 添加callId参数，可选
}

export default function CallScreen({ phoneNumber, onHangup, callId }: CallScreenProps) {
  const [callStatus, setCallStatus] = useState<'dialing' | 'ringing' | 'connected' | 'ended'>('dialing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<string | null>(callId || null);
  const processedStatusesRef = useRef(new Set());
  const [callRecords, setCallRecords] = useState<any[]>([]);
  const appState = useRef(AppState.currentState);
  
  // 监听 App 状态变化
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App 从后台进入前台');
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 开始计时器函数
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // 停止计时器函数
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // 移除重复的通话初始化逻辑
  // 不再调用API发起通话，只处理UI显示和状态监听

  // 监听通话状态更新
  useEffect(() => {
    // 记录日志
    console.log('设置通话状态监听器...');
    
    const handleCallStatus = (data: any) => {
      console.log('接收到状态更新:', data);
      
      // 如果有callId，则使用它；否则尝试匹配电话号码
      const isThisCall = 
        (callIdRef.current && data.callId === callIdRef.current) || 
        (!callIdRef.current && data.phoneNumber === phoneNumber);
      
      // 确保只处理自己的通话
      if (!isThisCall) {
        console.log('忽略其他通话状态:', data.callId);
        return;
      }
      
      // 如果还没有callId，但匹配了电话号码，则记录callId
      if (!callIdRef.current && data.callId) {
        callIdRef.current = data.callId;
        console.log('记录callId:', data.callId);
      }
      
      // 检查是否已处理过该状态
      const statusKey = `${data.callId}-${data.status}${data.command || ''}`;
      if (processedStatusesRef.current.has(statusKey)) {
        console.log('忽略重复状态:', statusKey);
        return;
      }
      
      // 记录已处理的状态
      processedStatusesRef.current.add(statusKey);
      console.log('处理状态:', statusKey);
      
      // 处理后端发来的控制命令
      if (data.command === 'answer' && callStatus !== 'connected') {
        console.log('执行接听命令');
        setCallStatus('connected');
        startTimer();
      } else if (data.command === 'hangup') {
        console.log('执行挂断命令');
        setCallStatus('ended');
        stopTimer();
        // 延迟调用挂断回调，确保UI有时间更新
        setTimeout(() => {
          onHangup?.();
        }, 500);
      } else if (data.status === 'ringing' && callStatus === 'dialing') {
        console.log('更新为振铃状态');
        setCallStatus('ringing');
      }
    };

    // 添加事件监听器
    CallService.subscribeToCallStatus(handleCallStatus);
    
    // 清理函数
    return () => {
      console.log('移除通话状态监听器');
      CallService.unsubscribeFromCallStatus(handleCallStatus);
    };
  }, [callStatus, onHangup, phoneNumber]);

  // 处理挂断电话
  const handleHangup = async () => {
    try {
      if (callIdRef.current) {
        await CallService.hangupCall(callIdRef.current);
      } else {
        console.warn('尝试挂断但没有callId');
      }
    } catch (error) {
      console.error('挂断通话失败:', error);
    } finally {
      onHangup();
    }
  };

  // 格式化通话时间
  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 格式化电话号码
  const formatPhoneNumber = (number: string) => {
    // 简单格式化，可根据需要调整
    if (number.length === 11) {
      return `${number.slice(0, 3)} ${number.slice(3, 7)} ${number.slice(7)}`;
    }
    return number;
  };

  // 不再主动获取记录，删除相关代码
  // 余下的代码保持不变

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.callInfo}>
        <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber)}</Text>
        
        {/* 只保留一个计时器显示 */}
        <Text style={styles.callStatusText}>
          {callStatus === 'dialing' ? '正在拨打...' : 
           callStatus === 'ringing' ? '对方已振铃' : 
           callStatus === 'connected' ? formatDuration(callDuration) : 
           '通话结束'}
        </Text>
      </View>
      
      {/* 背景渐变 */}
      <LinearGradient
        colors={['#1a2a6c', '#b21f1f', '#fdbb2d']}
        style={styles.background}
      >
        {/* 顶部提示 */}
        <View style={styles.topPrompt}>
          <Ionicons name="mic" size={18} color="#FFFFFF" />
          <Text style={styles.promptText}>结束呼叫请说"挂断电话"</Text>
        </View>
        
        {/* 电话号码显示 */}
        <View style={styles.phoneNumberContainer}>
          <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber)}</Text>
          <Text style={styles.callStatusText}>
            {callStatus === 'dialing' ? '正在拨打...' : 
             callStatus === 'ringing' ? '对方已振铃' : 
             callStatus === 'connected' ? formatDuration(callDuration) : 
             '通话结束'}
          </Text>
        </View>
        
        {/* 中间空白区域 */}
        <View style={styles.middleSpace} />
        
        {/* 底部按钮区域 */}
        <View style={styles.bottomControls}>
          {/* 第一排按钮 */}
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="mic" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>录音</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="pause" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>等待</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="call-outline" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>添加通话</Text>
            </TouchableOpacity>
          </View>
          
          {/* 第二排按钮 */}
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="videocam" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>视频通话</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="mic-outline" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>语音</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="person" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>联系人</Text>
            </TouchableOpacity>
          </View>
          
          {/* 第三排按钮 */}
          <View style={styles.controlRow}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => setShowKeypad(!showKeypad)}
            >
              <Ionicons name="keypad" size={26} color="#FFFFFF" />
              <Text style={styles.buttonText}>拨号键盘</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.hangupButton} onPress={handleHangup}>
              <Ionicons name="call" size={32} color="#FFFFFF" style={{transform: [{rotate: '135deg'}]}} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={26} color={isSpeaker ? "#4CD964" : "#FFFFFF"} />
              <Text style={[styles.buttonText, isSpeaker && {color: '#4CD964'}]}>扬声器</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingBottom: 20,
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
  },
  phoneNumberContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  phoneNumber: {
    fontSize: 44,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  callStatusText: {
    fontSize: 16,
    color: '#CCCCCC',
    marginTop: 15,
  },
  middleSpace: {
    flex: 1,
  },
  bottomControls: {
    paddingBottom: 50,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 30,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: width / 3,
  },
  buttonText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 12,
  },
  hangupButton: {
    backgroundColor: '#E53935',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callInfo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
}); 