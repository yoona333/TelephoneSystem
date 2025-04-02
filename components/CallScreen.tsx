import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Dimensions, StatusBar, SafeAreaView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';

const { width, height } = Dimensions.get('window');

interface CallScreenProps {
  phoneNumber: string;
  onHangup: () => void;
}

export default function CallScreen({ phoneNumber, onHangup }: CallScreenProps) {
  const [callStatus, setCallStatus] = useState<'dialing' | 'connected' | 'ended'>('dialing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // 模拟通话连接
  useEffect(() => {
    const timer = setTimeout(() => {
      setCallStatus('connected');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // 通话计时器
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callStatus === 'connected') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  // 格式化通话时间
  const formatCallDuration = () => {
    const minutes = Math.floor(callDuration / 60);
    const seconds = callDuration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 处理挂断电话
  const handleHangup = () => {
    setCallStatus('ended');
    setTimeout(() => {
      onHangup();
    }, 500);
  };

  // 格式化电话号码显示
  const formatPhoneNumber = (number: string) => {
    if (number.length <= 3) return number;
    if (number.length <= 7) return `${number.slice(0, 3)} ${number.slice(3)}`;
    return `${number.slice(0, 3)} ${number.slice(3, 7)} ${number.slice(7)}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 背景渐变 */}
      <LinearGradient
        colors={['#05362B', '#011D15']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
            {callStatus === 'dialing' ? '正在拨号...' : formatCallDuration()}
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
    </View>
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
}); 