<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
window.PIXI=PIXI;//为了pixi-live2d-display内部调用
import { useAppStore } from '../stores/appStore';
const liveCanvas=ref( null);//创建变量绑定画布Let app; // 为了存储pixi实例Let model;// 为了存储live2d实例const displayText=ref(value:·');// 用于显示文本的变量
let app
let model

// 获取store实例
const store = useAppStore();
onMounted(async() => {
  app = new PIXI.Application({
    view: liveCanvas.value,
    resizeTo: window,
    autoSize: true,
    backgroundAlph:0,
    resolution: window.devicePixelRatio ,
    autoDensity: true,
    antialias: true,
    transparent: true,
  });
  
  // 添加窗口大小变化监听
  const resizeHandler = () => {
    if (model) {
      console.log('窗口大小变化')
      // 更新模型位置到窗口中心
      console.log(app.screen.width,app.screen.height)
      console.log(model.anchor)
      console.log(model.width,model.height)
      model.x = app.screen.width / 2;
      model.y = app.screen.height / 2;
    
      // 可选：根据窗口大小调整模型缩放比例
      // const scale = Math.min(app.screen.width, app.screen.height) / 1000;
      // console.log('缩放比例',scale) 
      // model.scale.set(scale);
    }
  };
  
  window.addEventListener('resize', resizeHandler);
  console.log('开始加载模型')
  // 使用IPC获取配置
  const config = await window.electron.ipcRenderer.invoke('get-config');
  const getPublicPath = new URL(('../../../public/live2d/model'), import.meta.url).href;
  const modelPath = encodeURI('/'+config.model.path)
  console.log('模型路径',getPublicPath+decodeURI(modelPath))
  // 加载Live2D模型
  model=await Live2DModel.from(getPublicPath+decodeURI(modelPath));
  // model=await Live2DModel.from("https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json");



  if(!model){
    console.error('模型加载失败')
    return;
  }
  app.stage.addChild(model);
  model.anchor.set(0.5); // 设置锚点居中
  model.scale.set(0.11);
  // 初始调用一次以确保正确位置
  resizeHandler();
  
  // 检查动作管理器
  if (model.internalModel && model.internalModel.motionManager) {
    console.log('动作管理器:', model.internalModel.motionManager);
    console.log('可用动作组:', model.internalModel.motionManager.definitions);
    
    // 遍历所有动作组
    const motionGroups = model.internalModel.motionManager.definitions;
    console.log('动作列表:');
    for (const groupName in motionGroups) {
      console.log(`动作组: ${groupName}`);
      const motions = motionGroups[groupName];
      motions.forEach((motion, index) => {
        console.log(`  动作 ${index}: ${motion.file || '未命名'}`);
      });
    }
    
    // 获取所有动作组名称
    const groupNames = Object.keys(motionGroups);
    console.log('所有动作组名称:', groupNames);
  } else {
    console.log('未找到动作管理器或动作定义');
  }

  // 检查鼠标悬停 更新工具栏显示状态
    // 添加鼠标进入模型区域的监听
    model.on('mouseover', () => {
    store.updateToolbar({ visible: true });
  });
  
  // 添加拖拽功能
  // makeDraggable(model);
  

  onBeforeUnmount(() => {
    // 移除事件监听
    window.removeEventListener('resize', resizeHandler);
    // 清理资源
    model?.destroy();
    app?.destroy();
  });
})

// 使模型可拖拽
function makeDraggable(model) {
  model.on('pointerdown', (e) => {
    model.dragging = true;
    model._pointerX = e.data.global.x - model.x;
    model._pointerY = e.data.global.y - model.y;
  });
  
  model.on('pointermove', (e) => {
    if (model.dragging) {
      model.position.x = e.data.global.x - model._pointerX;
      model.position.y = e.data.global.y - model._pointerY;
    }
  });
  
  model.on('pointerupoutside', () => (model.dragging = false));
  model.on('pointerup', () => (model.dragging = false));
}

</script>

<template>
  <canvas ref="liveCanvas"></canvas>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: relative; /* 添加这一行 */
}
</style>
