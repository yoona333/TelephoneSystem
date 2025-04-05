import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import CallService from '@/services/CallService';

// 定义电话记录类型
interface PhoneRecord {
  id: string;
  phoneNumber: string;
  time: string;
  timestamp: number;
  status: string;
}

export default function AdminScreen() {
  const [records, setRecords] = useState<PhoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergedRecords, setMergedRecords] = useState<PhoneRecord[]>([]);

  // 加载通话记录
  useEffect(() => {
    const loadCallRecords = async () => {
      try {
        setLoading(true);
        
        // 使用新的合并API端点
        const response = await fetch(`${CallService.API_URL}/api/merged-call-records`);
        
        if (!response.ok) {
          throw new Error(`加载记录失败: ${response.status}`);
        }
        
        const mergedRecords = await response.json();
        console.log(`获取了 ${mergedRecords.length} 条合并后的通话记录`);
        
        // 直接使用服务器合并好的记录
        setMergedRecords(mergedRecords);
      } catch (error) {
        console.error('加载通话记录失败:', error);
        
        // 错误情况下尝试使用旧API
        try {
          const serverRecords = await CallService.getCallRecords();
          // 处理记录，合并同一号码的多条记录
          const merged = mergeRecords(serverRecords);
          setMergedRecords(merged);
        } catch (fallbackError) {
          console.error('备用加载也失败:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCallRecords();

    // 设置定期刷新
    const intervalId = setInterval(loadCallRecords, 30000); // 每30秒刷新一次
    return () => clearInterval(intervalId);
  }, []);

  // 合并同一号码的多条记录
  const mergeRecords = (records: PhoneRecord[]): PhoneRecord[] => {
    const phoneMap = new Map<string, PhoneRecord>();
    
    // 对记录按时间戳排序（降序）
    const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp);
    
    // 为每个号码只保留最新的一条记录
    sortedRecords.forEach(record => {
      if (!phoneMap.has(record.phoneNumber)) {
        phoneMap.set(record.phoneNumber, record);
      }
    });
    
    // 转换为数组并返回
    return Array.from(phoneMap.values());
  };

  // 清空所有记录
  const clearAllRecords = async () => {
    try {
      const success = await CallService.syncCallRecords([]);
      if (success) {
        setRecords([]);
        setMergedRecords([]);
      }
    } catch (error) {
      console.error('清空记录失败:', error);
    }
  };

  // 处理拨打电话
  const handleCall = async (phoneNumber: string) => {
    try {
      const response = await CallService.initiateCall(phoneNumber);
      console.log('拨打电话成功:', response);
    } catch (error) {
      console.error('拨打电话失败:', error);
    }
  };

  // 处理挂断电话
  const handleHangup = async (phoneNumber: string) => {
    // 查找该号码的活跃通话ID
    try {
      const calls = await fetch(`${CallService.API_URL}/api/calls`);
      const activeCalls = await calls.json();
      
      const activeCall = activeCalls.find((call: any) => call.phoneNumber === phoneNumber);
      
      if (activeCall && activeCall.callId) {
        await CallService.hangupCall(activeCall.callId);
        console.log('挂断电话成功');
      } else {
        console.log('没有找到该号码的活跃通话');
      }
    } catch (error) {
      console.error('挂断电话失败:', error);
    }
  };

  // 渲染单个电话记录
  const renderItem = ({ item, index }: { item: PhoneRecord; index: number }) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{index + 1}</Text>
      <Text style={styles.cell}>{item.phoneNumber}</Text>
      <Text style={styles.cell}>{item.time}</Text>
      <View style={styles.actionCell}>
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => handleCall(item.phoneNumber)}
        >
          <Text style={styles.buttonText}>接通</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.hangupButton}
          onPress={() => handleHangup(item.phoneNumber)}
        >
          <Text style={styles.buttonText}>挂断</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: '通话管理系统',
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTitleStyle: {
            color: '#FFFFFF',
            fontSize: 20,
            fontWeight: 'bold',
          },
          headerRight: () => (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearAllRecords}
            >
              <Text style={styles.clearButtonText}>清空</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.headerCell}>#</Text>
              <Text style={styles.headerCell}>电话</Text>
              <Text style={styles.headerCell}>时间</Text>
              <Text style={styles.headerCell}>操作</Text>
            </View>
            <FlatList
              data={mergedRecords}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
            />
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    backgroundColor: '#222222',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerCell: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  cell: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },
  actionCell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 5,
  },
  hangupButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 10,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
}); 