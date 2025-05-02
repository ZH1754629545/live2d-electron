import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useConfigStore = defineStore('config', () => {
  const config = ref({});
  const isLoading = ref(false);
  
  // 加载配置
  const loadConfig = async () => {
    if (isLoading.value) return;
    
    isLoading.value = true;
    try {
      const configData = await window.electron.ipcRenderer.invoke('get-config');
      config.value = configData;
    } catch (error) {
      console.error('加载配置失败', error);
    } finally {
      isLoading.value = false;
    }
  };
  
  // 更新配置
  const updateConfig = async (newConfig) => {
    try {
      await window.electron.ipcRenderer.invoke('save-config', JSON.parse(JSON.stringify(newConfig)));
      config.value = newConfig;
      return true;
    } catch (error) {
      console.error('更新配置失败', error);
      return false;
    }
  };
  
  return {
    config,
    isLoading,
    loadConfig,
    updateConfig
  };
});