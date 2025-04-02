import React from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

// 添加类型定义
interface Contact {
  id: string;
  name: string;
  phone: string;
}

// 模拟联系人数据
const CONTACTS = [
  { id: '1', name: '张三', phone: '13800138000' },
  { id: '2', name: '李四', phone: '13900139000' },
  { id: '3', name: '王五', phone: '13700137000' },
  { id: '4', name: '赵六', phone: '13600136000' },
  { id: '5', name: '钱七', phone: '13500135000' },
];

export default function ContactsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={styles.contactItem}>
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>{item.name.charAt(0)}</ThemedText>
      </View>
      <View style={styles.contactInfo}>
        <ThemedText style={styles.contactName}>{item.name}</ThemedText>
        <ThemedText style={styles.contactPhone}>{item.phone}</ThemedText>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={CONTACTS}
        renderItem={renderContactItem}
        keyExtractor={item => item.id}
        style={styles.contactList}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contactList: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#FFFFFF',
  },
  contactPhone: {
    fontSize: 14,
    color: '#8E8E93',
  },
}); 