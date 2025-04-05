import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import CallService from '@/services/CallService';

import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    const initServer = async () => {
      console.log("初始化服务器连接...");
      try {
        const success = await CallService.warmupServer();
        console.log("服务器初始化结果:", success ? "成功" : "未连接");
      } catch (error) {
        console.error("服务器初始化错误:", error);
      }
    };
    
    initServer();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTintColor: '#FFFFFF',
          contentStyle: {
            backgroundColor: '#000000',
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-circle-outline';
          
          console.log('路由名称:', route.name);
          
          if (route.name === 'index') {
            iconName = 'call-outline';
          } else if (route.name === 'contacts') {
            iconName = 'person-outline';
          } else if (route.name === 'favorites') {
            iconName = 'star-outline';
          } else if (route.name === 'admin') {
            iconName = 'settings-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={focused ? '#007AFF' : '#999999'} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#222', 
          borderTopWidth: 0,
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
      <Tabs.Screen 
        name="admin" 
        options={{
          title: '管理',
          tabBarLabel: '管理'
        }} 
      />
    </Tabs>
  );
}
