<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { useMessageState, hideMessage} from '../services/messageService';
import { useConfigStore } from '../stores/configStore';
import { checkFirstStartOfDay, fetchWeatherAndShow,startHitokotoTimer ,cleanupMessageService,startTodoReminderTimer} from '../services/messageService';


// 获取消息状态
const { currentMessage, isVisible ,currentPriority} = useMessageState();

// 添加一个消息计数器，用于生成唯一的key
const messageCounter = ref(0);

// 监听消息变化，更新计数器
watch(currentMessage, () => {
  if (currentMessage.value) {
    messageCounter.value++;
  }
});

// 配置存储
const configStore = useConfigStore();
const q = useQuasar();

// 设置相关
const showSettings = ref(false);
const settings = ref({
  width: 300,
  height: 100,
  bottom: 20,
  left: 20,
  opacity: 0.8,
  autoHide: true,
  autoHideDelay: 5000
});


// 从配置文件加载设置
onMounted(async () => {
  await configStore.loadConfig();
  
  // 加载消息框设置
  if ((configStore.config as any).messageBox) {
    settings.value = { ...settings.value, ...(configStore.config as any).messageBox };
  }
  //检查天气
  const isFirstStart = await checkFirstStartOfDay();
  if (isFirstStart) {
    fetchWeatherAndShow();
  }
  startHitokotoTimer(1);
  startTodoReminderTimer(1);
});
onBeforeUnmount(()=>{
  cleanupMessageService();
})
// 计算样式
const boxStyle = computed(() => {
  return {
    width: `${settings.value.width}px`,
    height: `${settings.value.height}px`,
    bottom: `${settings.value.bottom}px`,
    left: `${settings.value.left}px`,
    opacity: settings.value.opacity
  };
});

// 保存设置
async function saveSettings() {
  try {
    // 更新配置
    const updatedConfig = {
      ...configStore.config,
      messageBox: { ...settings.value }
    };
    
    // 保存到配置文件
    const success = await configStore.updateConfig(updatedConfig);
    
    if (success) {
      q.notify({
        message: '设置已保存',
        color: 'positive',
        position: 'top',
        timeout: 2000
      });
    } else {
      throw new Error('保存失败');
    }
    
    showSettings.value = false;
  } catch (error) {
    console.error('保存设置失败', error);
    q.notify({
      message: '保存设置失败',
      color: 'negative',
      position: 'top',
      timeout: 2000
    });
  }
}
</script>

<template>
  <transition name="fade">
    <div v-if="isVisible" class="message-box" :style="boxStyle">
      <!-- 添加高优先级红点指示器 -->
      <div v-if="(currentPriority===10)" class="priority-indicator"></div>
      <div class="message-controls">
        <q-btn flat round dense icon="close" size="sm" @click="hideMessage" />
        <q-btn flat round dense icon="settings" size="sm" @click="showSettings = true" />
      </div>
      <div class="message-content">
        <!-- 添加:key属性，确保每次消息变化时重新渲染 -->
        <div class="typing-animation" :key="messageCounter">{{ currentMessage }}</div>
      </div>
    </div>
  </transition>
  
  <!-- 设置弹窗 -->
  <q-dialog v-model="showSettings" persistent>
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">消息框设置</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="q-mb-md setting-item">
          <div class="setting-label">宽度: {{ settings.width }}px</div>
          <q-slider v-model="settings.width" :min="200" :max="500" :step="10" />
        </div>
        
        <div class="q-mb-md setting-item">
          <div class="setting-label">高度: {{ settings.height }}px</div>
          <q-slider v-model="settings.height" :min="50" :max="200" :step="10" />
        </div>
        
        <div class="q-mb-md setting-item">
          <div class="setting-label">底部距离: {{ settings.bottom }}px</div>
          <q-slider v-model="settings.bottom" :min="0" :max="100" :step="5" />
        </div>
        
        <div class="q-mb-md setting-item">
          <div class="setting-label">左侧距离: {{ settings.left }}px</div>
          <q-slider v-model="settings.left" :min="0" :max="100" :step="5" />
        </div>
        
        <div class="q-mb-md setting-item">
          <div class="setting-label">透明度: {{ settings.opacity }}</div>
          <q-slider v-model="settings.opacity" :min="0.1" :max="1" :step="0.1" />
        </div>
        
        <div class="q-mb-md">
          <q-checkbox v-model="settings.autoHide" label="自动隐藏" />
        </div>
        
        <div class="q-mb-md setting-item" v-if="settings.autoHide">
          <div class="setting-label">自动隐藏延迟: {{ settings.autoHideDelay / 1000 }}秒</div>
          <q-slider v-model="settings.autoHideDelay" :min="1000" :max="10000" :step="1000" />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" v-close-popup />
        <q-btn flat label="保存" color="primary" @click="saveSettings" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.message-box {
  position: fixed;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

/* 添加高优先级指示器样式 */
.priority-indicator {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background-color: #ff5252; /* 红色 */
  box-shadow: 0 0 5px rgba(255, 0, 0, 0.5);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.7);
  }
  
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(255, 82, 82, 0);
  }
  
  100% {
    transform: scale(0.8);
    box-shadow: 0 0 0 0 rgba(255, 82, 82, 0);
  }
}

.message-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.message-content {
  flex: 1;
  overflow-x: auto; /* 添加水平滚动 */
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.5;
  /* 添加滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

/* 自定义滚动条样式 */
.message-content::-webkit-scrollbar {
  height: 6px; /* 水平滚动条高度 */
  width: 6px; /* 垂直滚动条宽度 */
}

.message-content::-webkit-scrollbar-track {
  background: transparent;
}

.message-content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.message-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

/* CSS 打字动画 - 修改为支持滚动 */
.typing-animation {
  overflow: hidden;
  border-right: 2px solid #333;
  white-space: nowrap;
  display: inline-block; /* 使元素宽度适应内容 */
  letter-spacing: 0.1em;
  animation: 
    typing 1.5s steps(40, end),
    blink-caret 0.75s step-end infinite;
}

@keyframes typing {
  from { width: 0 }
  to { width: 100% }
}

@keyframes blink-caret {
  from, to { border-color: transparent }
  50% { border-color: #333 }
}

/* 其他样式保持不变 */
</style>