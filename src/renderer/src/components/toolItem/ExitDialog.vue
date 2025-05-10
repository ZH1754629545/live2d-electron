<script setup lang="ts">
import { playSystemAudio } from '@renderer/services/audioService';

const emit = defineEmits(['close']);

// 关闭对话框
const closeDialog = () => {
  emit('close');
};
const closeWin=async()=>{
    try {
    closeDialog();
    await playSystemAudio('exit');
    await window.electron.ipcRenderer.invoke('exit-app');
  } catch (error) {
    console.error('退出应用失败:', error);
  }
    console.log('关闭窗口')
}
</script>

<template>
  <div class="exit-dialog">
    <div class="dialog-content">
      <p>确定要退出吗？</p>
    </div>
    <div style="width:100%;display:flex;justify-content:flex-end">
        <q-btn label="确定" color="primary" @click="closeWin" class="btn" />
            <q-btn label="取消" color="primary" @click="closeDialog" class="btn" />
    </div>
  </div>

</template>

<style scoped>
.btn{
    margin-left:10px;
}
</style>