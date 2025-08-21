<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { useConfigStore } from '../stores/configStore';
import { defineAsyncComponent } from 'vue';
const AIChatPanel = defineAsyncComponent(() => import('./AIChatPanel.vue'));

// Visible state is managed here (separate from legacy MessageBox visibility)
const isVisible = ref(true);

const q = useQuasar();
const configStore = useConfigStore();

const settings = ref({
  width: 390,
  height: 160,
  bottom: 40,
  left: 30,
  opacity: 0.95,
  autoHide: false,
  autoHideDelay: 5000
});

const showSettings = ref(false);
const showChatDialog = ref(false);
const mcpEnabled = ref(false);

// Computed properties for template
const ttsConfig = computed(() => (configStore.config as any)?.tts || null);
const translationConfig = computed(() => (configStore.config as any)?.translation || null);
const assistantAvatarUrl = computed(() => (configStore.config as any)?.avatar?.assistant || '');
const apiBase = computed(() => 'http://localhost:8080/api');

// Dynamic box height that can grow with iframe content up to a cap
const currentBoxHeight = ref<number>(settings.value.height);

// Track viewport to keep box within window on resize
const viewportWidth = ref<number>(window.innerWidth);
const viewportHeight = ref<number>(window.innerHeight);
const safePadding = 8; // px padding from edges

const maxBoxHeight = computed(() => {
  // Allow up to 3x base height, but at least 320px
  return Math.max(settings.value.height * 3, 320);
});

const headerHeight = 32; // minimal header with expand button

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const boxStyle = computed(() => {
  // Desired dimensions
  const desiredHeight = Math.min(Math.max(currentBoxHeight.value, settings.value.height), maxBoxHeight.value);
  const maxAllowedHeight = Math.max(100, viewportHeight.value - safePadding - settings.value.bottom);
  const heightPx = clamp(desiredHeight, 80, maxAllowedHeight);

  const maxAllowedWidth = Math.max(160, viewportWidth.value - safePadding * 2);
  const widthPx = clamp(settings.value.width, 160, maxAllowedWidth);

  // Center horizontally within viewport
  const centeredLeft = Math.round((viewportWidth.value - widthPx) / 2);
  const maxLeft = Math.max(safePadding, viewportWidth.value - widthPx - safePadding);
  const leftPx = clamp(centeredLeft, safePadding, maxLeft);

  const maxBottom = Math.max(safePadding, viewportHeight.value - heightPx - safePadding);
  const bottomPx = clamp(settings.value.bottom, safePadding, maxBottom);

  return {
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    bottom: `${bottomPx}px`,
    left: `${leftPx}px`,
    opacity: String(settings.value.opacity)
  } as Record<string, string>;
});



// iframe sources removed after refactor to Vue child component

function onChildResize(p: { height: number; from: 'input' | 'content' }) {
  const desiredBoxHeight = p.height + headerHeight + 16;
  const next = Math.min(desiredBoxHeight, maxBoxHeight.value);
  if (p.from === 'input') {
    currentBoxHeight.value = next;
  } else if (Math.abs(next - currentBoxHeight.value) >= 8) {
    currentBoxHeight.value = next;
  }
}

const fullWindowStyle = computed(() => {
  return {
    backgroundColor: `rgba(255,255,255, ${settings.value.opacity})`,
    borderRadius: '12px'
  } as Record<string, string>;
});

function handleFrameMessage(event: MessageEvent) {
  // Optionally, validate event.origin if needed
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'chat:resize') {
    // Only respond to resize events coming from the compact (small) iframe
    const smallIframe = document.getElementById('ai-chat-iframe') as HTMLIFrameElement | null;
    if (!smallIframe || event.source !== smallIframe.contentWindow) {
      return;
    }
    const desiredContentHeight = Number(data.height) || 0; // iframe inner desired total height
    // Box height should include header
    const desiredBoxHeight = desiredContentHeight + headerHeight + 16; // include padding
    const next = Math.min(desiredBoxHeight, maxBoxHeight.value);
    // 仅在需要时更新，避免菜单/切换产生的多余抖动
    // 当来自输入框引起的高度变化时，直接应用以确保每换行整体增高一行
    if (data.from === 'input') {
      currentBoxHeight.value = next;
      return;
    }
    if (Math.abs(next - currentBoxHeight.value) >= 8) {
      currentBoxHeight.value = next;
    }
  }
  if (data.type === 'chat:openSettings') {
    showSettings.value = true;
  }
  if ((data as any).type === 'chat:history') {
    const fullIframe = document.getElementById('ai-chat-iframe-full') as HTMLIFrameElement | null;
    if (fullIframe && fullIframe.contentWindow) {
      fullIframe.contentWindow.postMessage({ type: 'chat:history', messages: (data as any).messages || [] }, '*');
    }
  }
}

function openFullChat() {
  showChatDialog.value = true;
  // Request history from compact iframe and forward to full iframe when available
  setTimeout(() => {
    const smallIframe = document.getElementById('ai-chat-iframe') as HTMLIFrameElement | null;
    if (smallIframe && smallIframe.contentWindow) {
      smallIframe.contentWindow.postMessage({ type: 'chat:getHistory' }, '*');
    }
    // Also apply avatar CSS var and TTS config to full iframe when ready
    const assistantAvatar = (configStore.config as any)?.avatar?.assistant || '/resources/avatar/mari_normal.png';
    const fullInterval = setInterval(() => {
      const fullIframe = document.getElementById('ai-chat-iframe-full') as HTMLIFrameElement | null;
      if (fullIframe && fullIframe.contentDocument && fullIframe.contentDocument.documentElement) {
        fullIframe.contentDocument.documentElement.style.setProperty('--assistant-avatar', `url('${assistantAvatar}')`);
        // push TTS config to full iframe
        const ttsConfig = (configStore.config as any)?.tts || null;
        try { fullIframe.contentWindow?.postMessage({ type: 'chat:ttsConfig', config: ttsConfig }, '*'); } catch {}
        clearInterval(fullInterval);
      }
    }, 200);
  }, 200);
}



async function saveMcpSettings() {
  try {
    const updatedConfig = {
      ...configStore.config,
      mcp: {
        enabled: mcpEnabled.value
      }
    } as Record<string, unknown>;
    const success = await configStore.updateConfig(updatedConfig);
    if (!success) throw new Error('保存失败');
  } catch (error) {
    console.error('保存 MCP 设置失败', error);
  }
}

async function saveSettings() {
  try {
    const updatedConfig = {
      ...configStore.config,
      messageBox: { ...settings.value }
    } as Record<string, unknown>;
    const success = await configStore.updateConfig(updatedConfig);
    if (!success) throw new Error('保存失败');
    q.notify({ message: '设置已保存', color: 'positive', position: 'top', timeout: 1500 });
    showSettings.value = false;
  } catch (error) {
    console.error('保存设置失败', error);
    q.notify({ message: '保存设置失败', color: 'negative', position: 'top', timeout: 2000 });
  }
}

onMounted(async () => {
  await configStore.loadConfig();
  if ((configStore.config as any)?.messageBox) {
    settings.value = { ...settings.value, ...(configStore.config as any).messageBox };
    currentBoxHeight.value = settings.value.height;
  }
  
  // 加载 MCP 配置
  const mcpConfig = (configStore.config as any)?.mcp;
  if (mcpConfig) {
    mcpEnabled.value = mcpConfig.enabled || false;
  }
  // Push assistant avatar to iframes via CSS var
  const assistantAvatar = (configStore.config as any)?.avatar?.assistant || '/resources/avatar/mari_normal.png';
  const applyAvatarVar = (id: string) => {
    const el = document.getElementById(id) as HTMLIFrameElement | null;
    if (el && el.contentDocument && el.contentDocument.documentElement) {
      el.contentDocument.documentElement.style.setProperty('--assistant-avatar', `url('${assistantAvatar}')`);
    }
  };
  // Immediately push TTS config to compact iframe on mount (and again on load)
  const initialTtsConfig = (configStore.config as any)?.tts || null;
  const compactElImmediate = document.getElementById('ai-chat-iframe') as HTMLIFrameElement | null;
  if (compactElImmediate?.contentWindow) {
    try { compactElImmediate.contentWindow.postMessage({ type: 'chat:ttsConfig', config: initialTtsConfig }, '*'); } catch {}
    compactElImmediate.addEventListener('load', () => {
      try { compactElImmediate.contentWindow?.postMessage({ type: 'chat:ttsConfig', config: initialTtsConfig }, '*'); } catch {}
    }, { once: true });
  }
  // apply to compact iframe once ready
  const compactInterval = setInterval(() => {
    const el = document.getElementById('ai-chat-iframe') as HTMLIFrameElement | null;
    if (el && el.contentDocument) {
      applyAvatarVar('ai-chat-iframe');
      // push TTS config to iframe
      const ttsConfig = (configStore.config as any)?.tts || null;
      try { el.contentWindow?.postMessage({ type: 'chat:ttsConfig', config: ttsConfig }, '*'); } catch {}
      clearInterval(compactInterval);
    }
  }, 200);
  window.addEventListener('message', handleFrameMessage);
  const onResize = () => {
    viewportWidth.value = window.innerWidth;
    viewportHeight.value = window.innerHeight;
  };
  window.addEventListener('resize', onResize);
  // Store to cleanup
  (window as any).__aiChatBox_onResize = onResize;
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleFrameMessage);
  const onResize = (window as any).__aiChatBox_onResize;
  if (onResize) window.removeEventListener('resize', onResize);
});

</script>

<template>
  <transition name="fade">
    <div v-if="isVisible" class="ai-chat-box" :style="boxStyle">
      <div class="chat-header">
        <div class="left">
          <q-btn flat round dense icon="menu" size="sm">
            <q-menu anchor="bottom left" self="top left">
              <q-list dense>
                <q-item clickable v-ripple @click="showSettings = true">
                  <q-item-section> 设置 </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="spacer"></div>
        <q-btn flat round dense icon="open_in_new" size="sm" @click="openFullChat" />
      </div>
      <div class="chat-content">
        <AIChatPanel
          :mode="'compact'"
          :maxInputPx="120"
          :mcp-enabled="mcpEnabled"
          :tts-config="ttsConfig"
          :translation="translationConfig"
          :assistant-avatar-url="assistantAvatarUrl"
          :api-base="apiBase"
          @resize="onChildResize"
          @openSettings="showSettings = true"
        />
      </div>
    </div>
  </transition>

  <!-- 设置弹窗与 MessageBox 保持风格一致 -->
  <q-dialog v-model="showSettings" persistent>
    <q-card class="settings-dialog">
      <q-card-section class="dialog-header">
        <div class="text-h6">AI 对话框设置</div>
      </q-card-section>

      <q-card-section class="q-pt-none dialog-content">
        <div class="q-mb-md setting-item">
          <div class="setting-label">宽度: {{ settings.width }}px</div>
          <q-slider v-model="settings.width" :min="260" :max="600" :step="10" />
        </div>
        <div class="q-mb-md setting-item">
          <div class="setting-label">基础高度: {{ settings.height }}px</div>
          <q-slider v-model="settings.height" :min="120" :max="360" :step="10" />
        </div>
        <div class="q-mb-md setting-item">
          <div class="setting-label">底部距离: {{ settings.bottom }}px</div>
          <q-slider v-model="settings.bottom" :min="0" :max="100" :step="5" />
        </div>
        <div class="q-mb-md setting-item">
          <div class="setting-label">左侧距离: {{ settings.left }}px</div>
          <q-slider v-model="settings.left" :min="0" :max="100" :step="5" />
        </div>
        <div class="q-mb-md setting-item">
          <div class="setting-label">透明度: {{ settings.opacity }}</div>
          <q-slider v-model="settings.opacity" :min="0.1" :max="1" :step="0.05" />
        </div>
      </q-card-section>

      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="取消" color="primary" v-close-popup />
        <q-btn flat label="保存" color="primary" @click="saveSettings" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Full chat dialog (WeChat-like) -->
  <q-dialog v-model="showChatDialog" persistent>
    <q-card class="chat-window" :style="fullWindowStyle">
      <div class="chat-window-header">
        <div class="title">对话</div>
        <div class="header-controls">
          <q-toggle 
            v-model="mcpEnabled" 
            label="MCP服务" 
            dense 
            @update:model-value="saveMcpSettings"
          />
          <q-btn flat round dense icon="close" size="sm" @click="showChatDialog = false" />
        </div>
      </div>
      <div class="chat-window-body">
        <AIChatPanel
          :mode="'full'"
          :maxInputPx="160"
          :mcp-enabled="mcpEnabled"
          :tts-config="ttsConfig"
          :translation="translationConfig"
          :assistant-avatar-url="assistantAvatarUrl"
          :api-base="apiBase"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.ai-chat-box {
  position: fixed;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.18);
  padding: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: all 0.25s ease;
  backdrop-filter: blur(3px);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.chat-header .spacer { flex: 1; }

.chat-content {
  flex: 1;
  min-height: 60px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.chat-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 8px;
  background: #fafafa;
}

/* Dialog styles aligned with MessageBox */
.settings-dialog {
  width: 80%;
  max-width: 90vw;
  max-height: 90vh;
  min-width: min(350px, 95vw);
  transition: width 0.3s, height 0.3s;
  display: flex;
  flex-direction: column;
}

.dialog-header { padding: 12px 20px; }
.dialog-content { flex: 1; overflow-y: auto; padding: 0 20px; }
.dialog-actions { padding: 8px 20px; }

@media (max-width: 400px) {
  .settings-dialog { width: 95%; }
}

/* Full chat dialog */
.chat-window {
  width: min(1000px, 92vw);
  height: min(900px, 90vh);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.chat-window-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-bottom: 1px solid rgba(0,0,0,0.06);
}
.chat-window-header .title { font-weight: 600; }
.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.chat-window-body { flex: 1; overflow: hidden; }
</style>


