<script setup lang="ts">
import {ref } from 'vue';
// 修改导入语句
import '@quasar/extras/fontawesome-v5/fontawesome-v5.css'
const showButton = ref(false);
// 使用防抖函数
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const handleMouseEnter = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  showButton.value = true;
};
const handleMouseLeave = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    showButton.value = false;
  }, 2000);
};

</script>

<template>
  <!-- 移除 v-if 条件，改为始终显示容器，但按钮根据条件显示 -->
  <div class="drag-container" 
       @mouseenter="handleMouseEnter" 
       @mouseleave="handleMouseLeave"
   >
    <div v-show="showButton" 
         class="drag-btn"
         >
      <q-icon name="fas fa-arrows-alt" size="sm" style="color: #ccc;" />
   </div>
 
  </div>
</template>

<style scoped>
.drag-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  /* 移除拖拽属性，让事件可以正常触发 */
  background-color: transparent;
  width: 40px;
  height: 40px;
  margin: 20px;
}

.drag-btn {

  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  /* 只在按钮上设置拖拽属性 */
  -webkit-app-region: drag;
}

.drag-btn:hover {
  background-color: rgba(255,255,255,0.3);
}

.drag-btn svg {
  color: #ccc;
}
</style>