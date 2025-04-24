<script setup lang="ts">
import { useAppStore } from '../stores/appStore';
import { computed, ref, shallowRef, defineAsyncComponent } from 'vue';

const store = useAppStore();
const visible = computed(() => store.toolbar.visible);
const showDialog = ref(false);
const currentComponent = shallowRef(null);
const dialogTitle = ref('');

// 示例工具项列表，增加组件路径
const toolItems = [

  // { id: 2, name: '换装', icon: 'style', component: 'DressupDialog' },
  // { id: 3, name: '表情', icon: 'face', component: 'ExpressionDialog' },
  // { id: 4, name: '动作', icon: 'directions_run', component: 'MotionDialog' },
  // { id: 5, name: '截图', icon: 'photo_camera', component: 'ScreenshotDialog' },
  // { id: 6, name: '音量', icon: 'volume_up', component: 'VolumeDialog' },
  // { id: 7, name: '背景', icon: 'image', component: 'BackgroundDialog' },
  // { id: 8, name: '置顶', icon: 'vertical_align_top', component: 'TopMostDialog' },
  // { id: 9, name: '锁定', icon: 'lock', component: 'LockDialog' },
  { id: 1, name: '设置', icon: 'settings', component: 'SettingsDialog' },
  { id: 2, name: '模型', icon: 'person', component: 'ModelDialog' },
  { id: 10, name: '关于', icon: 'info', component: 'AboutDialog' },
  { id:11 ,name:'退出',icon:"logout",component:'ExitDialog'}
];

// 动态导入组件
const componentMap = {
  SettingsDialog: defineAsyncComponent(() => import('./toolItem/SettingsDialog.vue')),
  // DressupDialog: () => import('./dialogs/DressupDialog.vue'),
  // ExpressionDialog: () => import('./dialogs/ExpressionDialog.vue'),
  // MotionDialog: () => import('./dialogs/MotionDialog.vue'),
  // ScreenshotDialog: () => import('./dialogs/ScreenshotDialog.vue'),
  // VolumeDialog: () => import('./dialogs/VolumeDialog.vue'),
  // BackgroundDialog: () => import('./dialogs/BackgroundDialog.vue'),
  // TopMostDialog: () => import('./dialogs/TopMostDialog.vue'),
  // LockDialog: () => import('./dialogs/LockDialog.vue'),
  AboutDialog: defineAsyncComponent(() => import('./toolItem/AboutDialog.vue')),
  ExitDialog: defineAsyncComponent(() => import('./toolItem/ExitDialog.vue')),
  ModelDialog: defineAsyncComponent(() => import('./toolItem/ModelDialog.vue')),
};

// 打开弹窗方法
const openDialog = (item) => {
  dialogTitle.value = item.name;
  currentComponent.value = componentMap[item.component];
  console.log(currentComponent.value)
  showDialog.value = true;
};

// 关闭弹窗方法
const handleMouseLeave=()=>{
  store.updateToolbar({ visible: false });
}
</script>

<template>
  <transition name="slide">
    <div v-if="visible" class="toolbar-list q-pa-sm" @mouseleave="handleMouseLeave">
      <q-list class="rounded-borders">
        <q-item 
          v-for="item in toolItems" 
          :key="item.id" 
          clickable 
          v-ripple 
          class="q-my-sm toolbar-item"
          @click="openDialog(item)"
        >
          <q-item-section avatar>
            <q-icon :name="item.icon" color="primary" size="1.5rem" />
          </q-item-section>
          <q-item-section>{{ item.name }}</q-item-section>
        </q-item>
      </q-list>
    </div>
  </transition>

  <!-- 弹窗组件 -->
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ dialogTitle }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- 动态组件 -->
        <component 
          :is="currentComponent" 
          v-if="currentComponent"
          @close="showDialog = false"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.toolbar-list {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.85); /* 增加透明度 */
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-height: 80vh;
  overflow-y: auto;
  width: 100px; /* 减小宽度 */
  z-index: 100;
  animation: float 3s ease-in-out infinite;
}

.toolbar-list::-webkit-scrollbar {
    width: 0;
    display: none;
  }
@keyframes float {
  0% {
    transform: translateY(-50%);
  }
  50% {
    transform: translateY(-53%);
  }
  100% {
    transform: translateY(-50%);
  }
}

.toolbar-item {
  border-radius: 6px;
  margin: 4px 0;
  transition: all 0.3s ease;
}

.toolbar-item:hover {
  transform: translateX(5px);
  background: rgba(0, 0, 0, 0.05);
}

.toolbar-item:active {
  transform: translateX(2px) scale(0.98);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-20px) translateY(-50%);
  opacity: 0;
}

.q-item__section--avatar {
  color: inherit;
  min-width: 10px;
}
</style>