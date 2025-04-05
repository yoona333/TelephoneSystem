declare module 'envenc' {
  export function encrypt(text: string, key: string): string;
  export function decrypt(encryptedText: string, key: string): string;
} 