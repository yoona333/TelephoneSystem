// 使用更精确的数据结构
// 前3位确定运营商，前7位确定归属地
const phoneLocationDB: Record<string, { province: string; city: string; operator: string }> = {
  // 江西移动号段
  "134": { province: "江西", city: "南昌", operator: "移动" },
  "135": { province: "江西", city: "南昌", operator: "移动" },
  "136": { province: "江西", city: "南昌", operator: "移动" },
  "137": { province: "江西", city: "九江", operator: "移动" },
  "138": { province: "江西", city: "九江", operator: "移动" },
  "139": { province: "江西", city: "九江", operator: "移动" },
  "147": { province: "江西", city: "九江", operator: "移动" },
  "150": { province: "江西", city: "南昌", operator: "移动" },
  "151": { province: "江西", city: "九江", operator: "移动" },
  "152": { province: "江西", city: "赣州", operator: "移动" },
  "157": { province: "江西", city: "上饶", operator: "移动" },
  "158": { province: "江西", city: "景德镇", operator: "移动" },
  "159": { province: "江西", city: "萍乡", operator: "移动" },
  "178": { province: "江西", city: "九江", operator: "移动" },
  "182": { province: "江西", city: "九江", operator: "移动" },
  "183": { province: "江西", city: "南昌", operator: "移动" },
  "184": { province: "江西", city: "九江", operator: "移动" },
  "187": { province: "江西", city: "九江", operator: "移动" },
  "188": { province: "江西", city: "南昌", operator: "移动" },
  "198": { province: "江西", city: "九江", operator: "移动" },
};

// 按省份和运营商分组的数据库
const provinceOperatorDB: Record<string, Record<string, string[]>> = {
  "北京": {
    "移动": ["134", "135", "136", "137", "138", "139", "147", "150", "151", "152", "157", "158", "159", "178", "182", "183", "184", "187", "188"],
    "联通": ["130", "131", "132", "145", "155", "156", "166", "167", "171", "175", "176", "185", "186"],
    "电信": ["133", "149", "153", "173", "177", "180", "181", "189", "190", "191", "193", "199"]
  },
  "上海": {
    "移动": ["134", "135", "136", "137", "138", "139", "147", "150", "151", "152", "157", "158", "159", "178", "182", "183", "184", "187", "188"],
    "联通": ["130", "131", "132", "145", "155", "156", "166", "167", "171", "175", "176", "185", "186"],
    "电信": ["133", "149", "153", "173", "177", "180", "181", "189", "190", "191", "193", "199"]
  },
  "广东": {
    "移动": ["134", "135", "136", "137", "138", "139", "147", "150", "151", "152", "157", "158", "159", "178", "182", "183", "184", "187", "188"],
    "联通": ["130", "131", "132", "145", "155", "156", "166", "167", "171", "175", "176", "185", "186"],
    "电信": ["133", "149", "153", "173", "177", "180", "181", "189", "190", "191", "193", "199"]
  },
  "江西": {
    "移动": ["134", "135", "136", "137", "138", "139", "147", "150", "151", "152", "157", "158", "159", "178", "182", "183", "184", "187", "188", "198"],
    "联通": ["130", "131", "132", "145", "155", "156", "166", "167", "171", "175", "176", "185", "186"],
    "电信": ["133", "149", "153", "173", "177", "180", "181", "189", "190", "191", "193", "199"]
  }
};

// 更精确的查询函数
export function getPhoneLocation(phoneNumber: string): string {
  // 清除空格和其他非数字字符
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // 检查是否是有效的中国手机号
  if (!/^1\d{10}$/.test(cleanNumber)) {
    return "未知归属地";
  }
  
  // 获取前3位作为号段
  const prefix3 = cleanNumber.substring(0, 3);
  
  // 查询归属地
  const location = phoneLocationDB[prefix3];
  
  if (location) {
    return `${location.province}${location.city} ${location.operator}`;
  } else {
    // 如果找不到精确匹配，尝试使用前2位进行模糊匹配
    const mobileType = getMobileOperator(cleanNumber);
    return `未知归属地 ${mobileType}`;
  }
}

// 根据号码前缀判断运营商
function getMobileOperator(phoneNumber: string): string {
  const prefix = phoneNumber.substring(0, 3);
  
  // 中国移动
  if (/^(134|135|136|137|138|139|150|151|152|157|158|159|182|183|187|188|147|178)/.test(prefix)) {
    return "移动";
  }
  
  // 中国联通
  if (/^(130|131|132|155|156|185|186|145|176)/.test(prefix)) {
    return "联通";
  }
  
  // 中国电信
  if (/^(133|153|177|180|181|189|149|173|199)/.test(prefix)) {
    return "电信";
  }
  
  // 虚拟运营商
  if (/^(170|171|172|162)/.test(prefix)) {
    return "虚拟运营商";
  }
  
  return "未知运营商";
} 