<script setup lang="ts">
import Live2d from "./components/live2d.vue";
import DragButton from "./components/drag.vue";
import ToolbarList from "./components/ToolbarList.vue";

const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
</script>

<template>
  <div class="app-container">
    <DragButton style="-webkit-app-region: drag; "></DragButton>
    <ToolbarList></ToolbarList>
    <live2d></live2d>    
  </div>
</template>

<style scoped>
.app-container {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
