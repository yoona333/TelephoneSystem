import * as ExpoHaptics from 'expo-haptics';

// 简单包装Expo的Haptics API并添加常量
export const Haptics = {
  // 触感反馈
  impactAsync: (style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light) => {
    return ExpoHaptics.impactAsync(style);
  },
  
  // 通知反馈
  notificationAsync: (type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success) => {
    return ExpoHaptics.notificationAsync(type);
  },
  
  // 选择反馈
  selectionAsync: () => {
    return ExpoHaptics.selectionAsync();
  },
  
  // 添加常量
  ImpactFeedbackStyle: ExpoHaptics.ImpactFeedbackStyle,
  NotificationFeedbackType: ExpoHaptics.NotificationFeedbackType
}; 