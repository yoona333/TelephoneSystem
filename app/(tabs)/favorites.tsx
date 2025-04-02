import React from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// 添加类型定义
interface Favorite {
  id: string;
  name: string;
  phone: string;
  type: 'mobile' | 'home' | 'work';
}

// 修改模拟数据中 type 的值为联合类型中的值
const FAVORITES: Favorite[] = [
  { id: '1', name: '张三', phone: '13800138000', type: 'mobile' },
  { id: '2', name: '李四', phone: '13900139000', type: 'home' },
  { id: '3', name: '王五', phone: '13700137000', type: 'work' },
];

export default function FavoritesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const renderFavoriteItem = ({ item }: { item: Favorite }) => (
    <TouchableOpacity style={styles.favoriteItem}>
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>{item.name.charAt(0)}</ThemedText>
      </View>
      <View style={styles.favoriteInfo}>
        <ThemedText style={styles.favoriteName}>{item.name}</ThemedText>
        <View style={styles.favoriteSubInfo}>
          <ThemedText style={styles.favoriteType}>
            {item.type === 'mobile' ? '手机' : item.type === 'home' ? '住宅' : '工作'}
          </ThemedText>
          <ThemedText style={styles.favoritePhone}>{item.phone}</ThemedText>
        </View>
      </View>
      <TouchableOpacity style={styles.callButton}>
        <Ionicons name="call" size={22} color="#007AFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={FAVORITES}
        renderItem={renderFavoriteItem}
        keyExtractor={item => item.id}
        style={styles.favoriteList}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // 黑色背景
  },
  favoriteList: {
    flex: 1,
  },
  favoriteItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333', // 深灰色边框
    backgroundColor: '#000000', // 黑色背景
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
  favoriteInfo: {
    flex: 1,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#FFFFFF', // 白色文本
  },
  favoriteSubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteType: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 10,
  },
  favoritePhone: {
    fontSize: 14,
    color: '#8E8E93',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 