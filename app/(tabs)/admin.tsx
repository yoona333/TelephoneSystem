import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallService from '@/services/CallService';

// 定义电话记录类型
interface PhoneRecord {
  id: string;
  phoneNumber: string;
  time: string;
  timestamp: number;
  status: string;
}

// 定义活跃通话类型
interface ActiveCall {
  callId: string;
  phoneNumber: string;
  status: string;
  startTime: string;
  duration?: number;
}

export default function AdminScreen() {
  const [mergedRecords, setMergedRecords] = useState<PhoneRecord[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // 加载通话记录和活跃通话
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // 加载合并的通话记录
        const recordsResponse = await fetch(`${CallService.API_URL}/api/merged-call-records`);
        if (recordsResponse.ok) {
          const mergedRecords = await recordsResponse.json();
          console.log(`获取了 ${mergedRecords.length} 条合并后的通话记录`);
          setMergedRecords(mergedRecords);
        }
        
        // 加载活跃通话
        const callsResponse = await fetch(`${CallService.API_URL}/api/calls`);
        if (callsResponse.ok) {
          const activeCalls = await callsResponse.json();
          console.log(`获取了 ${activeCalls.length} 个活跃通话`);
          setActiveCalls(activeCalls);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        
        // 错误情况下尝试使用备用API
        try {
          const serverRecords = await CallService.getCallRecords();
          const merged = mergeRecords(serverRecords);
          setMergedRecords(merged);
        } catch (fallbackError) {
          console.error('备用加载也失败:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // 设置定期刷新
    const intervalId = setInterval(loadData, 30000);
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
        setMergedRecords([]);
      }
    } catch (error) {
      console.error('清空记录失败:', error);
    }
  };

  // 导出记录
  const exportRecords = () => {
    console.log('导出记录功能暂未实现');
    // 在真实场景中，可以实现导出为CSV或其他格式
  };

  // 同步手机记录
  const syncPhoneRecords = async () => {
    try {
      const success = await CallService.syncCallRecords([]);
      if (success) {
        console.log('同步成功');
        // 重新加载记录
        const response = await fetch(`${CallService.API_URL}/api/merged-call-records`);
        if (response.ok) {
          const mergedRecords = await response.json();
          setMergedRecords(mergedRecords);
        }
      }
    } catch (error) {
      console.error('同步记录失败:', error);
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

  // 打开网页版控制台
  const openWebConsole = async () => {
    const url = 'https://telephonesystem.onrender.com/';
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      console.error('无法打开URL:', url);
    }
  };

  // 渲染当前通话内容
  const renderCurrentCalls = () => {
    if (activeCalls.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无活跃通话</Text>
        </View>
      );
    }

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>电话号码</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>状态</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>开始时间</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>操作</Text>
          </View>
        </View>
        
        <ScrollView style={styles.tableBody}>
          {activeCalls.map((call, index) => (
            <View key={`active-call-${call.callId}-${index}`} style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={styles.cellText}>{call.phoneNumber}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.cellText}>
                  {call.status === 'ringing' ? '振铃中' : 
                   call.status === 'active' ? '通话中' : 
                   call.status === 'ended' ? '已结束' : call.status}
                </Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.cellText}>
                  {new Date(call.startTime).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </Text>
              </View>
              <View style={styles.tableCell}>
                <TouchableOpacity 
                  style={styles.hangupButton}
                  onPress={() => handleHangup(call.phoneNumber)}
                >
                  <Text style={styles.buttonText}>挂断</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // 渲染通话历史内容
  const renderCallHistory = () => {
    if (mergedRecords.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无通话记录</Text>
        </View>
      );
    }

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>电话号码</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>状态</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>时间</Text>
          </View>
          <View style={styles.tableCell}>
            <Text style={styles.headerText}>操作</Text>
          </View>
        </View>
        
        <ScrollView style={styles.tableBody}>
          {mergedRecords.map((record, index) => (
            <View key={`merged-record-${record.id}-${index}`} style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={styles.cellText}>{record.phoneNumber}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.cellText}>{record.status}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.cellText}>{record.time}</Text>
              </View>
              <View style={styles.tableCell}>
                <TouchableOpacity 
                  style={styles.callButton}
                  onPress={() => handleCall(record.phoneNumber)}
                >
                  <Text style={styles.buttonText}>拨打</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '电话系统控制台',
          headerStyle: {
            backgroundColor: '#222',
          },
          headerTitleStyle: {
            color: '#FFFFFF',
            fontSize: 20,
            fontWeight: 'bold',
          },
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                style={styles.webButton}
                onPress={openWebConsole}
              >
                <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
                <Text style={styles.webButtonText}>网页版</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={clearAllRecords}
              >
                <Text style={styles.clearButtonText}>清空</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <View style={styles.content}>
            {/* 顶部标签栏 */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'current' && styles.activeTab]}
                onPress={() => setActiveTab('current')}
              >
                <Text style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>
                  当前通话
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                onPress={() => setActiveTab('history')}
              >
                <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                  通话历史
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* 按钮区域 */}
            {activeTab === 'history' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={exportRecords}>
                  <Text style={styles.actionButtonText}>导出记录</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={syncPhoneRecords}>
                  <Text style={styles.actionButtonText}>同步手机记录</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* 内容区域 */}
            <View style={styles.tabContent}>
              {activeTab === 'current' ? renderCurrentCalls() : renderCallHistory()}
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 10,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 5,
    marginBottom: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#444',
    borderRadius: 5,
  },
  tabText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 5,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#444',
    paddingVertical: 12,
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  headerText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  cellText: {
    fontSize: 14,
    color: '#ccc',
  },
  callButton: {
    backgroundColor: '#28a745',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  hangupButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 5,
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  webButton: {
    backgroundColor: '#007bff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
}); 