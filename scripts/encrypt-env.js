// 直接实现简单的加密解密，避免envenc包的问题
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 加密函数
function encrypt(text, key) {
  // 创建16字节的初始化向量
  const iv = crypto.randomBytes(16);
  // 从密钥创建哈希
  const keyHash = crypto.createHash('sha256').update(String(key)).digest('base64').substr(0, 32);
  // 创建加密器
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(keyHash), iv);
  // 加密
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  // 返回iv + 加密内容的base64形式
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 设置加密密钥
const SECRET_KEY = 'your-secret-key-change-in-production';

// 需要加密的API密钥
const secrets = {
  ALI_APP_CODE: '86a937097fb84ee280334b6678c528aa',
  ALI_APP_KEY: '204847948',
  ALI_APP_SECRET: '3Napqyh0A4s7c5jXzpZJ5Q4g5PDKmb1D'
};

// 加密所有密钥
const encrypted = {};
Object.entries(secrets).forEach(([key, value]) => {
  encrypted[key] = encrypt(value, SECRET_KEY);
  console.log(`已加密: ${key}`);
});

// 写入加密后的JSON文件
fs.writeFileSync(
  path.join(__dirname, '../encrypted-keys.json'),
  JSON.stringify(encrypted, null, 2)
);

console.log('所有密钥已加密并保存到 encrypted-keys.json');
console.log('注意: 请妥善保管SECRET_KEY，它是解密这些数据的唯一途径');