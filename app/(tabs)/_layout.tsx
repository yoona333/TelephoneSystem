import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';

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

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <Tabs
      screenOptions={({ route }) => ({
        // 配置统一的导航头部样式
        headerStyle: {
          backgroundColor: '#000000', // 黑色导航栏
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: '#FFFFFF', // 白色文本
          fontSize: 22,
        },
        headerTitleAlign: 'left',
        // 右侧四点点菜单
        headerRight: () => (
          <Pressable style={{ marginRight: 15 }}>
            <FourDots />
          </Pressable>
        ),
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          
          if (route.name.split('/').pop() === 'index') {
            iconName = focused ? 'call' : 'call-outline';
          } else if (route.name.split('/').pop() === 'contacts') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name.split('/').pop() === 'favorites') {
            iconName = focused ? 'star' : 'star-outline';
          } else {
            iconName = 'help-circle-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={focused ? '#007AFF' : '#999999'} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999999',
        tabBarButton: (props) => {
          return (
            <Pressable
              {...props}
              android_ripple={{ 
                color: 'rgba(255, 255, 255, 0.2)', 
                borderless: false
              }}
              style={({ pressed }) => [
                props.style,
                {
                  opacity: pressed ? 0.8 : 1,
                  backgroundColor: pressed ? 'rgba(255, 255, 255, 0.15)' : undefined,
                  borderRadius: 13,
                  overflow: 'hidden',
                  flex: 1
                },
              ]}
            />
          );
        },
        tabBarStyle: {
          backgroundColor: '#333333', // 深灰色标签栏
          borderTopWidth: 0,
          height: 60,
        },
      })}
    >
      <Tabs.Screen 
        name="index" 
        options={{
          title: '电话',
          tabBarLabel: '电话'
        }} 
      />
      <Tabs.Screen 
        name="contacts" 
        options={{
          title: '联系人',
          tabBarLabel: '联系人'
        }} 
      />
      <Tabs.Screen 
        name="favorites" 
        options={{
          title: '收藏',
          tabBarLabel: '收藏'
        }} 
      />
    </Tabs>
  );
}
