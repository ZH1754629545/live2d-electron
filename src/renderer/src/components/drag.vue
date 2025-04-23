<script setup lang="ts">
import { ref } from 'vue';
// 修改导入语句
import '@quasar/extras/fontawesome-v5/fontawesome-v5.css'
const showButton = ref(false);

const handleMouseEnter = () => {
  showButton.value = true;
};

const handleMouseLeave = () => {
    // 隐藏butto
    showButton.value = false;
};

// 添加拖动相关方法
const startDrag = (event: MouseEvent) => {
  // 记录初始鼠标位置
  let initialX = event.screenX;
  let initialY = event.screenY;
  
  // 发送开始拖动消息给主进程
  window.electron.ipcRenderer.send('start-drag', { x: initialX, y: initialY });
  
  // 添加鼠标移动事件监听
  const handleMouseMove = (e: MouseEvent) => {

    window.electron.ipcRenderer.send('drag-window', { 
      x: e.screenX, 
      y: e.screenY 
    });
  };
  
  // 添加鼠标释放事件监听
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    window.electron.ipcRenderer.send('end-drag');
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
</script>

<template>
  <div  class="drag-container" 
         @mouseenter="handleMouseEnter" 
         @mouseleave="handleMouseLeave"
         :style="{ width: showButton ? 'auto' : '40px', height: '40px' }">
    <q-btn 
      v-show="showButton"
      class="drag-btn"
      round
      @mousedown="startDrag"
    >
      <q-icon name="fas fa-arrows-alt" style="color: #ccc;"/>
    </q-btn>
  </div>
</template>

<style scoped>
.drag-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  /* 添加悬停区域 */
  background-color: transparent;  /* 透明背景保持不可见 */
  transition: background-color 0.3s;
  margin: 20px;
  border-radius: 100%;  
}

.drag-btn {
  cursor: move; /* 显示移动光标 */
}

.drag-container:hover {
  border-radius: 100%;  
  background-color: rgba(255,255,255,0.1); /* 可选：悬停时轻微背景色 */
}
</style>