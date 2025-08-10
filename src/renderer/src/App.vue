<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

// Use async components to avoid type resolution issues for .vue default exports in lints
const DragButton = defineAsyncComponent(() => import('./components/drag.vue'));
const ToolbarList = defineAsyncComponent(() => import('./components/ToolbarList.vue'));
// const MessageBox = defineAsyncComponent(() => import('./components/MessageBox.vue'));
const AIChatBox = defineAsyncComponent(() => import('./components/AIChatBox.vue'));
const Live2d = defineAsyncComponent(() => import('./components/Live2d.vue'));
</script>

<template>
  <div class="app-container">
    <DragButton ></DragButton>
    <ToolbarList></ToolbarList>
    <live2d></live2d>
    <!-- <MessageBox /> -->
    <AIChatBox />
  </div>
</template>

<style scoped>
.app-container {
  position: relative;
  width: 100%;
  height: 100%;
   /* 确保整个应用容器不可拖拽 */
   -webkit-app-region: no-drag;
}
</style>
