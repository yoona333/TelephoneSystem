// 手机号码归属地查询服务
import { getPhoneLocation as getLocalPhoneLocation } from '@/utils/PhoneLocation';
import { Config } from '@/utils/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 使用加密配置中的API密钥
const ALI_APP_CODE = Config.alicloud.appCode;

// 内存缓存
const locationCache: Record<string, string> = {};

// 添加防抖机制，避免并发请求
const pendingRequests: Record<string, Promise<string>> = {};

// 缓存键前缀
const CACHE_KEY_PREFIX = 'phone_location_';

// 从持久化存储加载缓存
const loadCacheFromStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const locationKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    if (locationKeys.length > 0) {
      const items = await AsyncStorage.multiGet(locationKeys);
      items.forEach(([key, value]) => {
        if (value) {
          const phoneNumber = key.replace(CACHE_KEY_PREFIX, '');
          locationCache[phoneNumber] = value;
        }
      });
      console.log(`从存储加载了${items.length}个归属地缓存`);
    }
  } catch (error) {
    console.error('加载归属地缓存失败:', error);
  }
};

// 初始加载缓存
loadCacheFromStorage();

export async function getPhoneLocation(phoneNumber: string): Promise<string> {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // 验证号码格式
  if (!/^1\d{10}$/.test(cleanNumber)) {
    return "未知归属地";
  }
  
  // 检查缓存
  if (locationCache[cleanNumber]) {
    // 不再每次都输出日志，减少重复
    return locationCache[cleanNumber];
  }
  
  // 检查是否有相同号码的请求正在进行中
  if (Object.prototype.hasOwnProperty.call(pendingRequests, cleanNumber)) {
    return pendingRequests[cleanNumber];
  }
  
  // 创建新请求并存储在pendingRequests中
  const requestPromise = (async () => {
    try {
      // 尝试从AsyncStorage获取
      const storedLocation = await AsyncStorage.getItem(CACHE_KEY_PREFIX + cleanNumber);
      if (storedLocation) {
        console.log(`从存储加载归属地: ${storedLocation}`);
        locationCache[cleanNumber] = storedLocation;
        return storedLocation;
      }
      
      console.log(`使用阿里云API查询号码: ${cleanNumber}`);
      
      // 确保有有效的API密钥
      if (!ALI_APP_CODE) {
        console.warn('阿里云AppCode未配置，使用本地数据');
        const localResult = getLocalPhoneLocation(cleanNumber);
        locationCache[cleanNumber] = localResult;
        await AsyncStorage.setItem(CACHE_KEY_PREFIX + cleanNumber, localResult);
        return localResult;
      }
      
      // 调用阿里云API
      const response = await fetch('https://sdmobiles.market.alicloudapi.com/mobile_location/check', {
        method: 'POST',
        headers: {
          'Authorization': `APPCODE ${ALI_APP_CODE}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `mobile=${cleanNumber}`
      });
      
      const data = await response.json();
      console.log('阿里云API响应:', JSON.stringify(data));
      
      // 解析API返回的数据
      if (data.code === 200 && data.data) {
        const province = data.data.provinceName || '';
        const city = data.data.cityName || '';
        const operator = data.data.channel || '';
        
        const simpleProvince = province.replace(/省$/, '');
        
        if (simpleProvince && city) {
          const location = `${simpleProvince}${city} ${operator}`;
          console.log(`成功获取归属地: ${location}`);
          locationCache[cleanNumber] = location;
          await AsyncStorage.setItem(CACHE_KEY_PREFIX + cleanNumber, location);
          return location;
        }
      }
      
      // 使用本地数据库作为备选
      console.log('无法从API获取完整归属地信息，使用本地数据');
      const localResult = getLocalPhoneLocation(cleanNumber);
      locationCache[cleanNumber] = localResult;
      await AsyncStorage.setItem(CACHE_KEY_PREFIX + cleanNumber, localResult);
      return localResult;
    } catch (error) {
      console.error('API请求失败:', error);
      const localResult = getLocalPhoneLocation(cleanNumber);
      locationCache[cleanNumber] = localResult;
      await AsyncStorage.setItem(CACHE_KEY_PREFIX + cleanNumber, localResult);
      return localResult;
    } finally {
      // 请求完成后，从pendingRequests中删除
      delete pendingRequests[cleanNumber];
    }
  })();
  
  // 存储请求Promise
  pendingRequests[cleanNumber] = requestPromise;
  
  return requestPromise;
} 