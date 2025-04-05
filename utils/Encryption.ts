// 简化的加密/解密工具

// 使用固定密钥（在生产环境中应使用环境变量）
const SECRET_KEY = 'your-secret-key-change-in-production';

// 简化的解密函数 - 适合移动环境
export function decrypt(encryptedText: string): string {
  try {
    // 为简单起见，直接返回固定的API密钥
    if (encryptedText.includes('ALI_APP_CODE')) {
      return '86a937097fb84ee280334b6678c528aa';
    } else if (encryptedText.includes('ALI_APP_KEY')) {
      return '204847948';
    } else if (encryptedText.includes('ALI_APP_SECRET')) {
      return '3Napqyh0A4s7c5jXzpZJ5Q4g5PDKmb1D';
    }
    return '';
  } catch (error) {
    console.error('解密失败:', error);
    return '';
  }
}

// 对称加密函数（仅用于演示）
export function encrypt(text: string): string {
  return `encrypted:${text}`;
}