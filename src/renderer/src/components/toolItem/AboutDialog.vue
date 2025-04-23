<script setup lang="ts">
const emit = defineEmits(['close']);

// 关闭对话框
const closeDialog = () => {
  emit('close');
};
</script>

<template>
  <div class="about-dialog">
    <h3>关于</h3>
    
    <p>Live2D桌面宠物</p>
    <p>版本: 1.0.0</p>
    <p>作者: ZH</p>
    <div class="row justify-end q-mt-md">
      <q-btn label="关闭" color="primary" @click="closeDialog" />
    </div>
  </div>
</template>

<style scoped>
.about-dialog {
  padding: 10px;
}
</style>