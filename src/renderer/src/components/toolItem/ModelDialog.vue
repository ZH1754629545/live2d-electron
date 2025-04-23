<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '../../stores/appStore';

const emit = defineEmits(['close']);
const store = useAppStore();
const modelFolders = ref([]);
const loading = ref(false);

// 获取模型文件夹列表
const getModelFolders = async () => {
  try {
    loading.value = true;
    const folders = await window.electron.ipcRenderer.invoke('get-model-folders');
    modelFolders.value = folders;
  } catch (error) {
    console.error('获取模型文件夹失败:', error);
  } finally {
    loading.value = false;
  }
};

// 加载选中的模型
const loadModel = async (folderName) => {
  try {
    loading.value = true;
    // 获取文件夹下的model3.json文件
    const modelFiles = await window.electron.ipcRenderer.invoke('get-model-files', folderName);
    
    if (modelFiles && modelFiles.length > 0) {
      // 更新配置中的模型路径，使用找到的model3.json文件的相对路径
      const config = await window.electron.ipcRenderer.invoke('get-config');
      config.model.path = `${folderName}/${modelFiles[0]}`;
      await window.electron.ipcRenderer.invoke('save-config', config);
      // 发送事件通知重新加载模型
      store.updateLive2d({ reload: true, path: `${folderName}/${modelFiles[0]}` });
    } else {
      console.error('未找到model3.json文件');
    }
    
    // 关闭对话框
    emit('close');
  } catch (error) {
    console.error('加载模型失败:', error);
  } finally {
    loading.value = false;
  }
};

// 关闭对话框
const closeDialog = () => {
  emit('close');
};

onMounted(() => {
  getModelFolders();
});
</script>

<template>
  <div class="model-dialog">
    <div v-if="loading" class="text-center">
      <q-spinner color="primary" size="3em" />
      <p>加载中...</p>
    </div>
    
    <div v-else>
      <p class="text-subtitle1 q-mb-md">选择模型:</p>
      
      <q-list bordered separator>
        <q-item 
          v-for="folder in modelFolders" 
          :key="folder"
          clickable
          v-ripple
          @click="loadModel(folder)"
        >
          <q-item-section avatar>
            <q-icon name="person" color="primary" />
          </q-item-section>
          <q-item-section>{{ folder }}</q-item-section>
        </q-item>
      </q-list>
      
      <div v-if="modelFolders.length === 0" class="text-center q-pa-md">
        <p>没有找到模型文件夹</p>
      </div>
      
      <div class="row justify-end q-mt-md">
        <q-btn label="取消" color="grey" flat @click="closeDialog" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-dialog {
  padding: 10px;
  min-height: 200px;
}
</style>