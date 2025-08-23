<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount,watch } from 'vue';
import * as PIXI from 'pixi.js';
// @ts-ignore
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { 
  Live2dAnimator, 
  BlinkAnimator, 
  EyeBallAnimator, 
  AngleAnimator, 
  BodyAngleAnimator, 
  ExpressionAnimator,
  LipSyncAnimator,
  updateExpression
} from '../utils/live2dAnimators';
// 声明全局PIXI
declare global {
  interface Window {
    PIXI: typeof PIXI;
  }
}
window.PIXI=PIXI;//为了pixi-live2d-display内部调用
import { useAppStore } from '../stores/appStore';
import { showNextMessage } from '../services/messageService';
const liveCanvas=ref( null);//创建变量绑定画布
let app // 为了存储pixi实例
let model // 为了存储live2d实例

// 动画系统相关变量
let live2dAnimator: Live2dAnimator | null = null;
let blinkAnimator: BlinkAnimator | null = null;
let eyeBallAnimator: EyeBallAnimator | null = null;
let angleAnimator: AngleAnimator | null = null;
let bodyAngleAnimator: BodyAngleAnimator | null = null;
let expressionAnimator: ExpressionAnimator | null = null;
let lipSyncAnimator: LipSyncAnimator | null = null;
let animationLoop: number | null = null;

// 获取store实例
const store = useAppStore();
const loadLive2DModel=async()=>{
  app = new PIXI.Application({
    // @ts-ignore
    view: liveCanvas.value,
    resizeTo: window,
    // @ts-ignore
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
  console.log('模型配置',config)
  // const getPublicPath = new URL(('../../../../resources/public/live2d/model'), import.meta.url).href;
  // const modelPath = encodeURI('/'+config.model.path)
  // console.log('模型路径',getPublicPath+decodeURI(modelPath))
  // // 加载Live2D模型
  // console.log(getPublicPath+decodeURI(modelPath))
  const modelPath=await window.electron.ipcRenderer.invoke('get-model-path')
  console.log('模型路径',modelPath)
  // 🚫 加载模型时禁用自动交互和鼠标跟踪
  model=await Live2DModel.from(modelPath, {
    autoInteract: false,        // 禁用自动交互
  });
  // model=await Live2DModel.from("https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json");



  if(!model){
    console.error('模型加载失败')
    return;
  }
  app.stage.addChild(model);
  model.anchor.set(0.5); // 设置锚点居中
  model.scale.set(config.model.scale); // 设置模型缩放比例
  
  // 获取可用表情列表
  console.log('模型对象:', model);
  console.log('模型内部对象:', model.internalModel);
  
  // 尝试多种方式获取表情列表
  let expressionNames: string[] = [];
  
  // 方法1: 通过 model.expressions
  if (model.expressions) {
    console.log('通过 model.expressions 获取:', model.expressions);
    if (Array.isArray(model.expressions)) {
      expressionNames = model.expressions.map(exp => exp.name || exp);
    } else if (typeof model.expressions === 'object') {
      expressionNames = Object.keys(model.expressions);
    }
  }
  
  // 方法2: 通过 internalModel
  if (expressionNames.length === 0 && model.internalModel) {
    console.log('尝试通过 internalModel 获取表情');
    
    // 检查不同的可能路径
    if (model.internalModel.expressions) {
      console.log('model.internalModel.expressions:', model.internalModel.expressions);
      
      if (model.internalModel.expressions.definitions) {
        const definitions = model.internalModel.expressions.definitions;
        console.log('表情定义:', definitions);
        expressionNames = Object.keys(definitions);
      } else if (Array.isArray(model.internalModel.expressions)) {
        expressionNames = model.internalModel.expressions.map(exp => exp.name || exp);
      }
    }
    
    // 尝试其他可能的路径
    if (expressionNames.length === 0 && model.internalModel.motions) {
      console.log('检查 motions 中是否有表情:', model.internalModel.motions);
    }
  }
  
  
  store.updateLive2d({ availableExpressions: expressionNames });
  
  // 初始化动画系统
  initializeAnimationSystem(model);
  
  // 初始调用一次以确保正确位置
  resizeHandler();
  // 检查鼠标悬停 更新工具栏显示状态
  // 添加鼠标进入模型区域的监听

  model.on('rightclick', () => {
    store.updateToolbar({ visible: true });
  });
  // 添加拖拽功能
  // makeDraggable(model);
  

  onBeforeUnmount(() => {
    // 停止动画循环
    stopAnimationSystem();
    // 移除事件监听
    window.removeEventListener('resize', resizeHandler);
    // 清理资源
    model?.destroy();
    app?.destroy();
  });
}
onMounted(async() => {
  // 加载模型
  await loadLive2DModel()
})
//监听是否切换模型
watch(() => store.live2d.reload, (newValue) => {
  if (newValue) {
    loadLive2DModel();
    // 重置reload状态
    store.updateLive2d({ reload: false });
  }
});
//监听模型缩放
watch(() => store.live2d.scale, (newScale) => {
  if (model && newScale) {
    model.scale.set(newScale);
  }
});
//监听模型拖拽
watch(() => store.live2d.draggable, (newValue) => {
  if (model) {
    if (newValue) {
      makeDraggable(model);
    } else {
      // 禁用拖动
      model.off('pointerdown');
      model.off('pointermove');
      model.off('pointerupoutside');
      model.off('pointerup');
    }
  }
});



// 初始化动画系统
function initializeAnimationSystem(model: any): void {
  try {
    // 创建动画器管理器
    live2dAnimator = new Live2dAnimator(model);
    
    // 创建各种动画器
    blinkAnimator = new BlinkAnimator();
    eyeBallAnimator = new EyeBallAnimator();
    angleAnimator = new AngleAnimator(eyeBallAnimator);
    bodyAngleAnimator = new BodyAngleAnimator(angleAnimator);
    expressionAnimator = new ExpressionAnimator();
    lipSyncAnimator = new LipSyncAnimator();
    
    // 按优先级添加动画器
    live2dAnimator.add(1, blinkAnimator);      // 眨眼 - 最低优先级
    live2dAnimator.add(2, eyeBallAnimator);    // 眼球移动
    live2dAnimator.add(3, angleAnimator);      // 头部角度
    live2dAnimator.add(4, bodyAngleAnimator);  // 身体角度
    live2dAnimator.add(5, expressionAnimator); // 表情
    live2dAnimator.add(6, lipSyncAnimator);    // 嘴部同步 - 最高优先级
    
    // 启动动画循环
    startAnimationLoop();
    
    // 暴露动画控制函数
    exposeAnimationControls();
  } catch (error) {
    console.error('Live2D动画系统初始化失败:', error);
  }
}

// 启动动画循环
function startAnimationLoop(): void {
  if (animationLoop) {
    cancelAnimationFrame(animationLoop);
  }
  
  const animate = () => {
    if (live2dAnimator && model) {
      try {
        live2dAnimator.update();
      } catch (error) {
        console.warn('动画更新失败:', error);
      }
    }
    
    animationLoop = requestAnimationFrame(animate);
  };
  
  animate();
}

// 停止动画系统
function stopAnimationSystem(): void {
  if (animationLoop) {
    cancelAnimationFrame(animationLoop);
    animationLoop = null;
  }
  
  // 清理动画器实例
  live2dAnimator = null;
  blinkAnimator = null;
  eyeBallAnimator = null;
  angleAnimator = null;
  bodyAngleAnimator = null;
  expressionAnimator = null;
}

// 从消息文本中触发表情动画
function triggerExpressionFromText(text: string): void {
  if (expressionAnimator) {
    updateExpression(text, expressionAnimator);
  }
}

// 暴露动画控制函数到全局
function exposeAnimationControls(): void {
  if (typeof window !== 'undefined') {
    (window as any).live2dAnimationControls = {
      // 表情控制
      setExpression: (happy: number) => {
        if (expressionAnimator) {
          expressionAnimator.start(happy);
          return true;
        }
        return false;
      },
      
      // 眨眼控制
      blink: () => {
        if (blinkAnimator) {
          blinkAnimator.triggerBlink();
          return true;
        }
        return false;
      },
      
      longBlink: () => {
        if (blinkAnimator) {
          blinkAnimator.triggerLongBlink();
          return true;
        }
        return false;
      },
      
      // 眼球移动控制
      moveEyes: () => {
        if (eyeBallAnimator) {
          (eyeBallAnimator as any).flag = 0;
          (eyeBallAnimator as any).timer = Date.now() / 1000 - 10;
          return true;
        }
        return false;
      },
      
      // 嘴部同步控制
      updateMouthSync: (audioChunk: Float32Array | number[]) => {
        if (lipSyncAnimator) {
          lipSyncAnimator.updateMouthSync(audioChunk);
          return true;
        }
        return false;
      },
      
      setMouthValue: (value: number) => {
        if (lipSyncAnimator) {
          lipSyncAnimator.setMouthValue(value);
          return true;
        }
        return false;
      },
      
      stopMouthSync: () => {
        if (lipSyncAnimator) {
          lipSyncAnimator.stopMouthSync();
          return true;
        }
        return false;
      },
      
      setLipSyncParameters: (params: any) => {
        if (lipSyncAnimator) {
          lipSyncAnimator.setParameters(params);
          return true;
        }
        return false;
      },
      
      getLipSyncStatus: () => {
        if (lipSyncAnimator) {
          return lipSyncAnimator.getStatus();
        }
        return null;
      },
      
      // 获取动画器实例（用于高级控制）
      getAnimators: () => ({
        live2dAnimator,
        blinkAnimator,
        eyeBallAnimator,
        angleAnimator,
        bodyAngleAnimator,
        expressionAnimator,
        lipSyncAnimator
      })
    };
  }
}

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
