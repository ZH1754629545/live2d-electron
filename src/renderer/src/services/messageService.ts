import { ref, readonly } from 'vue';
import { useConfigStore } from '../stores/configStore';

// 消息状态
const currentMessage = ref('');
const messageQueue = ref([]);
const isVisible = ref(false);

// 消息类型和优先级
type MessagePriority = 'low' | 'normal' | 'high';
const priorityValues = {
  low: 0,
  normal: 5,
  high: 10
};

// 消息接口
interface Message {
  text: string;
  priority: number;
  timestamp: number;
}

// 获取配置
const getConfig = async () => {
  const configStore = useConfigStore();
  await configStore.loadConfig();
  return configStore.config;
};

// 检查是否是当天第一次启动
export const checkFirstStartOfDay = async () => {
  const configStore = useConfigStore();
  await configStore.loadConfig();
  
  const today = new Date().toDateString();
  const lastStartDate = configStore.config.system?.lastStartDate || '';
  
  if (lastStartDate !== today) {
    // 更新最后启动日期
    await configStore.updateConfig({
      ...configStore.config,
      system: {
        ...configStore.config.system,
        lastStartDate: today
      }
    });
    
    return true;
  }
  
  return false;
};

// 添加消息到队列
export const addMessage = (text: string, priority: MessagePriority = 'normal') => {
  const priorityValue = priorityValues[priority];
  
  messageQueue.value.push({
    text,
    priority: priorityValue,
    timestamp: Date.now()
  });
  
  // 按优先级排序
  messageQueue.value.sort((a, b) => b.priority - a.priority);
  
  // 如果当前没有显示消息，则显示队列中的第一条
  if (!isVisible.value && messageQueue.value.length > 0) {
    showNextMessage();
  }
};

// 显示下一条消息
const showNextMessage = () => {
  if (messageQueue.value.length > 0) {
    const nextMessage = messageQueue.value.shift();
    currentMessage.value = nextMessage.text;
    isVisible.value = true;
    
    // 自动隐藏
    autoHideMessage();
  } else {
    currentMessage.value = '';
    isVisible.value = false;
  }
};

// 自动隐藏消息
const autoHideMessage = async () => {
  const config = await getConfig();
  
  if (config.messageBox?.autoHide && config.messageBox?.autoHideDelay > 0) {
    setTimeout(() => {
      hideMessage();
    }, config.messageBox.autoHideDelay);
  }
};

// 隐藏当前消息
export const hideMessage = () => {
  isVisible.value = false;
  currentMessage.value = '';
  
  // 检查队列中是否还有消息
  if (messageQueue.value.length > 0) {
    setTimeout(() => {
      showNextMessage();
    }, 500); // 短暂延迟后显示下一条
  }
};

// 清空所有消息
export const clearAllMessages = () => {
  messageQueue.value = [];
  currentMessage.value = '';
  isVisible.value = false;
};

// 预设消息类型
export const showWeatherMessage = (weatherInfo: string) => {
  addMessage(`今日天气: ${weatherInfo}`, 'high');
};

export const showReminderMessage = (reminder: string) => {
  addMessage(`提醒: ${reminder}`, 'normal');
};

export const showSystemMessage = (message: string) => {
  addMessage(`系统: ${message}`, 'low');
};

// 获取天气信息并显示
export const fetchWeatherAndShow = async () => {
  try {
    // 这里可以替换为实际的天气API调用
    // 示例：模拟获取天气信息
    const weatherInfo = await new Promise<string>(resolve => {
      setTimeout(() => {
        resolve('晴，温度：22°C-28°C，适合外出活动');
      }, 1000);
    });
    
    showWeatherMessage(weatherInfo);
  } catch (error) {
    console.error('获取天气信息失败', error);
  }
};

// 导出只读状态，供组件使用
export const useMessageState = () => {
  return {
    currentMessage: readonly(currentMessage),
    isVisible: readonly(isVisible)
  };
};