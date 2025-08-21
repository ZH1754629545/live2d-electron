<script setup lang="ts">
import { ref, onMounted ,watch} from 'vue';
import { useAppStore } from '../../stores/appStore';

const emit = defineEmits(['close']);
const store = useAppStore();
const loading = ref(false);

// 设置项
const settings = ref({
  scale: 0.11, // 默认缩放比例
  draggable: false, // 是否可拖动
  alwaysOnTop: false, // 是否置顶
  roundedCorners: false, // 圆角(边框显示)
  systemVolume: 50 // 添加系统音量设置，默认50%
});

// 获取当前配置
const getSettings = async () => {
  try {
    loading.value = true;
    const config = await window.electron.ipcRenderer.invoke('get-config');
    
    // 更新本地设置
    settings.value = {
      scale: config.model.scale || 0.11,
      draggable: config.model.draggable || false,
      alwaysOnTop: config.window.alwaysOnTop || false,
      roundedCorners: config.window.roundedCorners || false,
      systemVolume: config.system.systemVolume*100 || 50 // 获取音量设置
    };
  } catch (error) {
    console.error('获取设置失败:', error);
  } finally {
    loading.value = false;
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    loading.value = true;
    const config = await window.electron.ipcRenderer.invoke('get-config');
    let winConfigChange = (config.window.alwaysOnTop===settings.value.alwaysOnTop&&config.window.roundedCorners===settings.value.roundedCorners)?false:true;
    // 更新配置
    config.model.scale = settings.value.scale;
    config.model.draggable = settings.value.draggable;
    config.window.alwaysOnTop = settings.value.alwaysOnTop;
    config.window.roundedCorners = settings.value.roundedCorners;
    config.system.systemVolume = settings.value.systemVolume/100; // 保存音量设置
    
    await window.electron.ipcRenderer.invoke('save-config', config);
    
    // 通知应用更新设置
    store.updateLive2d({ 
      scale: settings.value.scale,
      draggable: settings.value.draggable
    });
    
    // 更新窗口设置
    if(winConfigChange)
    {
      await window.electron.ipcRenderer.invoke('update-window-settings', {
      alwaysOnTop: settings.value.alwaysOnTop,
      roundedCorners:settings.value.roundedCorners,
      });
    }

    
    // 关闭对话框
    emit('close');
  } catch (error) {
    console.error('保存设置失败:', error);
  } finally {
    loading.value = false;
  }
};

// 关闭对话框
const closeDialog = async() => {
  const config = await window.electron.ipcRenderer.invoke('get-config');
  const defaultScale = config.model.scale;
  const defaultDraggable = config.model.draggable;

  store.updateLive2d({ 
    scale: defaultScale,
    draggable: defaultDraggable
});
  emit('close');
};

// 重置设置
const resetSettings = () => {
  settings.value = {
    scale: 0.11,
    draggable: false,
    alwaysOnTop: false,
    roundedCorners: false,
    systemVolume: 50 // 重置音量
  };
};
watch(()=>settings.value.scale,(newScale)=>{
  store.updateLive2d({
    scale:newScale, 
  })
})
onMounted(() => {
  getSettings();
});
</script>

<template>
  <div class="settings-dialog">
    <div v-if="loading" class="text-center">
      <q-spinner color="primary" size="3em" />
      <p>加载中...</p>
    </div>
    
    <div v-else>
      <div class="q-mb-md">
        <p class="text-subtitle1 q-mb-sm">模型缩放</p>
        <q-slider
          v-model="settings.scale"
          :min="0.05"
          :max="0.8"
          :step="0.01"
          label
          label-always
          color="primary"
        />
        <div class="text-caption text-center">{{ (settings.scale * 100).toFixed(0) }}%</div>
      </div>
      <div class="q-mb-md">
        <p class="text-subtitle1 q-mb-sm">系统音量</p>
        <q-slider
          v-model="settings.systemVolume"
          :min="0"
          :max="100"
          :step="1"
          label
          label-always
          color="primary"
        />
        <div class="text-caption text-center">{{ settings.systemVolume }}%</div>
      </div>
      <div class="q-mb-md">
        <q-toggle
          v-model="settings.draggable"
          label="允许拖动模型"
          color="primary"
        />
      </div>
      <div class="q-mb-md">
        <q-toggle
          v-model="settings.alwaysOnTop"
          label="窗口置顶"
          color="primary"
        />
      </div>
      <div class="q-mb-md">
        <q-toggle
          v-model="settings.roundedCorners"
          label="窗口边框"
          color="primary"
        />
      </div>
      
      
      <div class="row justify-end q-mt-lg">
        <q-btn label="重置" color="grey" flat @click="resetSettings" class="q-mr-sm" />
        <q-btn label="取消" color="grey" flat @click="closeDialog" class="q-mr-sm" />
        <q-btn label="保存" color="primary" @click="saveSettings" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-dialog {
  padding: 10px;
  min-height: 200px;
}
</style>