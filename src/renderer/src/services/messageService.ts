import { ref, readonly } from 'vue';
import { useConfigStore } from '../stores/configStore';
import { useTodoStore } from '../stores/todoStore';
import axios from 'axios';
// 消息状态
const currentMessage = ref('');
const messageQueue = ref([]);
const isVisible = ref(false);
let hitokotoTimer = null; // 添加一言定时器变量
let messageIdCounter = 0; // 消息ID计数器，用于标识
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
  messageId: number; // 添加消息ID字段
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
  //text断句 碰到句号问号感叹号等就吧text分隔放入
 // 文本断句处理，碰到句号问号感叹号等就把text分隔放入队列
  const sentences = text.split(/(?<=[。！？.!?])/);
 // 过滤掉空字符串，并添加到消息队列
 sentences.filter(sentence => sentence.trim().length > 0).forEach(sentence => {
  messageQueue.value.push({
    text: sentence.trim(),
    priority: priorityValue,
    timestamp: Date.now(),
    messageId: messageIdCounter++ // 分配递增的消息ID
  });
});
  // 按优先级排序
  messageQueue.value.sort((a, b) => b.priority - a.priority);
  // 如果当前没有显示消息，则显示队列中的第一条
  if (!isVisible.value && messageQueue.value.length > 0) {
    showNextMessage();
  }
};

// 显示下一条消息
export const showNextMessage = async() => {
    isVisible.value = true;
  if (messageQueue.value.length > 0) {
    const nextMessage = messageQueue.value.shift();
    currentMessage.value = nextMessage.text;
    isVisible.value = true;
    // 自动隐藏
    autoHideMessage();
  } else {
    await fetchHitokotoAndShow();
    showNextMessage();
     //isVisible.value = false;

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
  addMessage(`${weatherInfo}`, 'high');
};

export const showReminderMessage = (reminder: string) => {
  addMessage(`提醒: ${reminder}`, 'normal');
};

export const showSystemMessage = (message: string) => {
  addMessage(`系统: ${message}`, 'low');
};

// 获取天气信息并显示
async function getTodayWeather() {


  try {
      console.log("获取今天的天气中...")
      // 阶段1：获取地理位置信息
      const { province, city, county } = await getReverseGeocode()
      console.log(province, city, county)
      // 阶段2：调用腾讯天气接口
      const response = await axios.get('https://wis.qq.com/weather/common', {
          params: {
              source: 'pc',
              weather_type: 'observe',  // 指定获取观测数据
              province: province,       // 省级行政区划
              city: city,               // 市级行政区划
              county: county            // 区级行政区划
          }
      });
      // 校验接口响应状态
      if (response.data.status !== 200) {
          throw new Error('天气接口响应异常: ' + response.data.message);
      }
      console.log(response.data)
      // 阶段3：处理天气数据
      const observeData = response.data.data.observe;
      return formatWeatherData(observeData);

  } catch (error) {
      console.error('天气获取流程失败:', error.message);
      throw new Error('服务暂不可用，请稍后重试');
  }
}



async function getReverseGeocode() {
  //默认
  let { province, city, county } ={
      province: "浙江省",
      city:"温州市",
      county:"龙湾区"
  }
  //重复尝试五次
  var reTry = 5;
  while(reTry--) {
      try {
          const res =await axios.get("https://my.ip.cn/json/",{timeout:5000})
          if(res.data.code ===0){
              {
                  province=res.data.data.province,
                  city=res.data.data.city,
                  county=res.data.data.district
              }
              break;
          }else{
              console.log("获取地理位置失败")
          }
      }catch (e){
          console.error("获取地理位置失败  "+e)
      }
  }
  return {province, city, county}


}

// 工具函数：格式化天气数据
function formatWeatherData(observeData) {
  // 生成中文日期
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份补零
  const day = String(now.getDate()).padStart(2, '0');        // 日期补零
  const date = `${year}年${month}月${day}日`;
  // 构造标准化返回对象
  return  `今天是${date}，${getTimeBasedGreeting()}\n当前天气${observeData.weather_short || observeData.weather}，气温${observeData.degree}°C。\n${generateWeatherTips(observeData)}`;
}

function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好！';
  if (hour < 9) return '早上好！';
  if (hour < 12) return '上午好！';
  if (hour < 14) return '中午好！';
  if (hour < 18) return '下午好！';
  return '晚上好！';
}
function generateWeatherTips(data) {
  const temp = parseInt(data.degree);
  let tips = '';

  if (temp > 28) tips = '天气炎热，请注意防暑降温';
  else if (temp > 20) tips = '气温不错，出去走走吧';
  else tips = '天气较凉，注意添加衣物';

  if (data.weather.includes('雨')) tips += '，记得携带雨伞哦';

  return tips;
}

export const fetchWeatherAndShow = async () => {
  try {
    // 这里可以替换为实际的天气API调用
    // 示例：模拟获取天气信息
    const weatherInfo = await new Promise<string>(resolve => {
      setTimeout(() => {
        getTodayWeather().then(res=>{
          resolve(res)
        })
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

// 获取一言并显示
export const fetchHitokotoAndShow = async () => {
  console.log("获取一言中...")
  try {
    const response = await fetch('https://v1.hitokoto.cn/?c=a');
    const data = await response.json();
    if (data && data.hitokoto) {
      // 添加一言消息，包含来源
      const message = data.from 
        ? `${data.hitokoto}` :'获取数据错误'
      
      addMessage(message, 'normal');
    }
  } catch (error) {
    console.error('获取一言失败', error);
    try{
      const response = await fetch('international.v1.hitokoto.cn/?c=a');
      const data = await response.json();
      console.log(data)
      if (data && data.hitokoto) {
        // 添加一言消息，包含来源
        const message = data.from
         ? `${data.hitokoto}` :'获取数据错误'
        addMessage(message, 'normal');
      }else{
        addMessage('网络好像有点阻塞', 'normal');
      }
    }catch(error){
      console.error('获取一言失败', error);
      addMessage('what can I say?', 'normal');
    }
  }
};

// 开始定期获取一言
export const startHitokotoTimer = async (defaultIntervalMinutes = 30) => {
  // 先清除可能存在的定时器
  stopHitokotoTimer();
  
  // 从配置中读取设置
  const config = await getConfig();
  const intervalMinutes = config.messageBox?.hitokotoInterval || defaultIntervalMinutes;
  // 设置定时器，定期获取
  const intervalMs = intervalMinutes * 60 * 1000;
  hitokotoTimer = setInterval(()=>{
    fetchHitokotoAndShow();
  },intervalMs)
};

// 停止一言定时器
export const stopHitokotoTimer = () => {
  if (hitokotoTimer) {
    clearInterval(hitokotoTimer);
    hitokotoTimer = null;
  }
};

// 添加待办事项提醒相关变量
let todoReminderTimer = null;
const reminderSentIds = new Set(); // 用于记录已发送提醒的待办ID

// 检查待办事项是否即将到期
const checkTodoReminders = () => {
  try {
    const todoStore = useTodoStore();
    console.log(todoStore.filteredAndSortedTodos)
    const todos = todoStore.todos;
    const now = new Date();
    
    todos.forEach(todo => {
      // 只检查未完成的待办事项
      if (!todo.completed && todo.dueTime) {
        const dueDate = new Date(todoStore.changeHHMMToDate(todo.dueTime));
        const diffMs = dueDate.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        
        // 如果还有30分钟左右过期，发送提醒
        if (diffMinutes > 0 && diffMinutes <= 30) {
          // 使用待办ID作为唯一标识，避免重复提醒
          const reminderKey = `todo_${todo.id}_30min`;
          
          if (!reminderSentIds.has(reminderKey)) {
            addMessage(`待办事项"${todo.title}"即将在${parseInt(diffMinutes)}分钟后到期，请及时处理！`, 'high');
            reminderSentIds.add(reminderKey);
            showNextMessage();
            // 24小时后清除提醒记录，允许再次提醒
            setTimeout(() => {
              reminderSentIds.delete(reminderKey);
            }, 24 * 60 * 60 * 1000);
            return
          }
        }
      }
    });
  } catch (error) {
    console.error('检查待办提醒失败:', error);
  }
};

// 开始待办事项提醒检查
export const startTodoReminderTimer = (defaultIntervalMinutes = 1) => {
  // 先清除可能存在的定时器
  stopTodoReminderTimer();
  const intervalMin = defaultIntervalMinutes*60 * 1000; // 每defalutIntervalMinutes分钟检查一次
  // 每分钟检查一次

  todoReminderTimer = setInterval(()=>{
    console.log("检查待办提醒")
    checkTodoReminders();
  },intervalMin)
  

};

// 停止待办事项提醒检查
export const stopTodoReminderTimer = () => {
  if (todoReminderTimer) {
    clearInterval(todoReminderTimer);
    todoReminderTimer = null;
  }
};
// 清理资源
export const cleanupMessageService = () => {
  stopHitokotoTimer();
  clearAllMessages();
};