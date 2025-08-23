<script lang="ts">
// ===== 真正的全局 WebSocket 管理（在所有组件实例外部） =====
let globalWebSocket: WebSocket | null = null;
let globalReconnectTimer: number | null = null;
const reconnectDelay = 3000;
let messageHandlers: ((message: string) => void)[] = [];
let currentApiBase: string = '';

function connectGlobalWebSocket(apiBase: string) {
  // 如果 API 基地址改变了，需要重新连接
  if (currentApiBase !== apiBase && globalWebSocket) {
    globalWebSocket.close(1000, 'API地址变更');
    globalWebSocket = null;
  }
  currentApiBase = apiBase;

  if (globalWebSocket && (globalWebSocket.readyState === WebSocket.CONNECTING || globalWebSocket.readyState === WebSocket.OPEN)) {
    console.log('WebSocket 已连接，复用现有连接');
    return;
  }

  try {
    const wsUrl = apiBase
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://') + '/websocket';
    console.log('建立新的 WebSocket 连接:', wsUrl);
    globalWebSocket = new WebSocket(wsUrl);
    
    globalWebSocket.onopen = () => {
      console.log('WebSocket 连接已建立:', wsUrl);
      if (globalReconnectTimer) {
        window.clearTimeout(globalReconnectTimer);
        globalReconnectTimer = null;
      }
    };

    globalWebSocket.onmessage = (event) => {
      try {
        const message = event.data;
        // console.log('收到 WebSocket 消息:', message);
        messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('消息处理函数执行失败:', error);
          }
        });
      } catch (error) {
        console.error('处理 WebSocket 消息失败:', error);
      }
    };

    globalWebSocket.onclose = (event) => {
      console.log('WebSocket 连接关闭:', event.code, event.reason);
      globalWebSocket = null;
      if (event.code !== 1000) {
        scheduleGlobalReconnect(apiBase);
      }
    };

    globalWebSocket.onerror = (error) => {
      console.error('WebSocket 连接错误:', error);
    };
  } catch (error) {
    console.error('创建 WebSocket 连接失败:', error);
    scheduleGlobalReconnect(apiBase);
  }
}

function scheduleGlobalReconnect(apiBase: string) {
  if (globalReconnectTimer) return;
  console.log(`${reconnectDelay}ms 后尝试重连 WebSocket`);
  globalReconnectTimer = window.setTimeout(() => {
    globalReconnectTimer = null;
    connectGlobalWebSocket(apiBase);
  }, reconnectDelay);
}

function registerMessageHandler(handler: (message: string) => void) {
  messageHandlers.push(handler);
  console.log('注册消息处理函数，当前处理函数数量:', messageHandlers.length);
}

function unregisterMessageHandler(handler: (message: string) => void) {
  const index = messageHandlers.indexOf(handler);
  if (index > -1) {
    messageHandlers.splice(index, 1);
    console.log('取消注册消息处理函数，当前处理函数数量:', messageHandlers.length);
  }
}

// 将函数挂载到全局，供组件使用
(window as any).chatWebSocketManager = {
  connectGlobalWebSocket,
  registerMessageHandler,
  unregisterMessageHandler
};
// ===== 全局 WebSocket 管理结束 =====
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, defineExpose } from 'vue';
// import { AudioQueue ,AudioQueueOptions} from '../services/audioService1';

type TtsConfig = {
  endpoint: string;
  enabled: boolean;
  params?: Record<string, unknown>;
} | null;

type TranslationConfig = {
  enabled: boolean;
  endpoint: string;
  from: string;
  to: string;
  apiKey?: string;
  appId?: string;
} | null;



const props = withDefaults(defineProps<{
  mode?: 'compact' | 'full';
  maxInputPx?: number;
  mcpEnabled?: boolean;
  ttsConfig?: TtsConfig;
  translation?: TranslationConfig;
  assistantAvatarUrl?: string;
  apiBase?: string;
}>(), {
  mode: 'compact',
  maxInputPx: 120,
  mcpEnabled: false,
  ttsConfig: null,
  translation: null,
  assistantAvatarUrl: '',
  apiBase: 'http://localhost:8080/api'
});

const emit = defineEmits<{
  (e: 'resize', payload: { height: number; from: 'input' | 'content' }): void
  (e: 'openSettings'): void
}>();

const rootEl = ref<HTMLElement | null>(null);
const messagesEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const sendDisabled = ref(false);

const endpointNormal = computed(() => `${props.apiBase}/character/generateStream`);
const endpointHistory = computed(() => `${props.apiBase}/character/getHistoryMessage`);
// ----- Compact mode state -----
const sentences = ref<string[]>(['']); // last is remainder
const currentIndex = ref<number>(-1);
let typeTimer: number | null = null;
const TYPE_SPEED = 20; // ms/char
const playedTtsIndices = ref<Set<number>>(new Set());
// 确保重复触发时中断上一次 TTS 请求，避免连接占用导致后续无效
let ttsAbortController: AbortController | null = null;

// ----- Full mode state -----
type ChatItem = { role: 'assistant' | 'user'; text: string; mcpMessages?: McpMessage[] };
type McpMessage = {
  messageType: string;
  content: string;
  toolInfo?: string;
  currentStep?: number;
  isFinal?: boolean;
  timestamp: string;
};

const historyCache = ref<ChatItem[]>([]);
const historyLoadedStart = ref(0);
const historyLoadedEnd = ref(0);
const historyPageSize = 10;

// MCP 相关状态
const mcpMessages = ref<McpMessage[]>([]);
const mcpSteps = ref<Map<number, McpMessage[]>>(new Map()); // 按step分组的消息
const mcpStats = ref({
  messageCount: 0,
  stepCount: 0,
  toolCallCount: 0,
  duration: 0
});
let mcpStartTime = 0;
let mcpDurationTimer: number | null = null;

// UI content for both modes
const assistantBubbleText = ref('');

/**
 * 处理表情更新数据，用于Live2D表情动画
 * @param happyValue 开心值 (0-10)
 * @param textContent 可选的文本内容
 */
function handleEmotionUpdate(happyValue: number, textContent?: string) {
  try {
    console.log(`😊 更新Live2D表情，开心值: ${happyValue}${textContent ? `，文本: "${textContent}"` : ''}`);
    
    // 🎯 调用Live2D表情控制功能
    if (typeof window !== 'undefined' && (window as any).live2dAnimationControls) {
      const success = (window as any).live2dAnimationControls.setExpression(happyValue);
      if (success) {
        console.log(`✅ Live2D表情更新成功，开心值: ${happyValue}`);
      } else {
        console.warn('⚠️ Live2D表情更新调用失败');
      }
    } else {
      console.warn('⚠️ Live2D动画控制器未初始化，无法更新表情');
    }
    
  } catch (error) {
    console.error('❌ 表情更新处理失败:', error);
  }
}

/**
 * 处理音频同步数据，用于Live2D嘴部动画
 * @param audioBuffer PCM音频数据数组（byte格式）
 */
function handleAudioSyncData(audioBuffer: number[]) {
  try {
    // 将byte数组转换为Float32Array（Live2D动画器需要的格式）
    const samples = audioBuffer.length / 2; // 16位PCM，每2个字节一个样本
    const floatData = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const byteIndex = i * 2;
      if (byteIndex + 1 < audioBuffer.length) {
        // 小端序读取16位PCM数据
        const low = audioBuffer[byteIndex] & 0xFF;
        const high = audioBuffer[byteIndex + 1];
        const sample = (high << 8) | low;
        
        // 处理符号位（16位有符号整数）
        const signedSample = sample > 32767 ? sample - 65536 : sample;
        
        // 归一化到 [-1.0, 1.0] 范围
        floatData[i] = signedSample / 32768.0;
      }
    }
    
    // 🎯 调用Live2D嘴部同步功能
    if (typeof window !== 'undefined' && (window as any).live2dAnimationControls) {
      const success = (window as any).live2dAnimationControls.updateMouthSync(floatData);
      if (!success) {
        console.warn('⚠️ Live2D嘴部同步调用失败');
      }
    } else {
      console.warn('⚠️ Live2D动画控制器未初始化，无法进行嘴部同步');
    }
    
  } catch (error) {
    console.error('❌ 音频同步数据处理失败:', error);
  }
}

function handlePassiveMessage(message: string) {
  if (!message || !message.trim()) return;
  
  // 过滤包含 ...ignore 的消息（后端 ping 消息）
  if (message.includes('...ignore')) {
    console.log('收到后端 ping 消息，忽略处理:', message);
    return;
  }
  
  // 🎯 检测特殊消息类型（音频数据、表情控制等）
  try {
    const parsedMessage = JSON.parse(message);
    
    // 处理音频数据消息
    if (parsedMessage && parsedMessage.audioBuffer && Array.isArray(parsedMessage.audioBuffer)) {
      console.log('🎤 收到音频同步数据，长度:', parsedMessage.audioBuffer.length);
      handleAudioSyncData(parsedMessage.audioBuffer);
      return; // 不处理为普通消息，直接返回
    }
    
    // 处理表情控制消息
    if (parsedMessage && typeof parsedMessage.happy === 'number') {
      console.log('😊 收到表情控制消息，开心值:', parsedMessage.happy);
      handleEmotionUpdate(parsedMessage.happy, parsedMessage.text);
      
      // 如果没有文本内容，直接返回（不显示在对话框中）
      if (!parsedMessage.text || !parsedMessage.text.trim()) {
        return;
      }
      
      // 如果有文本内容，使用文本内容继续处理
      message = parsedMessage.text.trim();
    }
    
  } catch (e) {
    // 如果不是JSON格式，继续按文本消息处理
  }
  
  // 🎯 检测文本中的表情标记（备用方案）
  const happyMatch = message.match(/happy:\s*(\d+(?:\.\d+)?)/i);
  if (happyMatch) {
    const happyValue = parseFloat(happyMatch[1]);
    console.log('😊 从文本中检测到表情控制，开心值:', happyValue);
    handleEmotionUpdate(happyValue);
    
    // 移除表情标记，保留其他文本
    message = message.replace(/happy:\s*\d+(?:\.\d+)?/gi, '').trim();
    
    // 如果移除表情标记后没有文本，直接返回
    if (!message) {
      return;
    }
  }
  
  // 使用与主动发送消息相同的处理逻辑
  if (props.mode === 'compact') {
    // compact 模式：重置状态并添加新消息
    assistantBubbleText.value = '';
    sentences.value = [''];
    currentIndex.value = -1;
    playedTtsIndices.value.clear();
    console.log('message',message)
    // 分割消息为句子并处理
    const seg = splitSentences(message);
    console.log('seg',seg)
    let idx = 0;
    for (const s of seg.completed) {
      sentences.value[idx] = s;
      sentences.value.push('');
      idx++;
    }
    sentences.value[sentences.value.length - 1] = seg.remainder;
    
    // 显示第一句
    const maxCompletedIndex = sentences.value.length - 2;
    if (maxCompletedIndex >= 0) {
      currentIndex.value = 0;
      renderCurrentSentenceTypewriter();
      // 触发 TTS
      const first = (sentences.value[0] || '').trim();
      if (first && !playedTtsIndices.value.has(0)) {
        playedTtsIndices.value.add(0);
        postTtsIfEnabled(first);
      }
    }
  } else {
    // full 模式：添加为新的助手消息
    historyCache.value.push({ role: 'assistant', text: message.trim() });
    
    // 更新显示窗口
    const currentWindow = Math.max(historyLoadedEnd.value - historyLoadedStart.value, historyPageSize);
    historyLoadedEnd.value = historyCache.value.length;
    historyLoadedStart.value = Math.max(0, historyLoadedEnd.value - currentWindow);
    
    // 触发 TTS
    postTtsIfEnabled(message.trim());
  }
  
  // 强制更新 UI 并滚动到底部
  nextTick(() => {
    messagesEl.value && (messagesEl.value.scrollTop = messagesEl.value.scrollHeight);
    measureAndEmit();
  });
}

function measureAndEmit(from: 'input' | 'content' = 'content') {
  nextTick(() => {
    const h = rootEl.value?.scrollHeight ?? 0;
    if (h > 0) emit('resize', { height: h, from });
  });
}

// MCP 相关辅助函数
function resetMcpState() {
  mcpMessages.value = [];
  mcpSteps.value.clear();
  mcpStats.value = {
    messageCount: 0,
    stepCount: 0,
    toolCallCount: 0,
    duration: 0
  };
  if (mcpDurationTimer) {
    clearInterval(mcpDurationTimer);
    mcpDurationTimer = null;
  }
}

function startMcpTimer() {
  mcpStartTime = Date.now();
  mcpDurationTimer = window.setInterval(() => {
    mcpStats.value.duration = Math.floor((Date.now() - mcpStartTime) / 1000);
  }, 1000) as unknown as number;
}

function handleMcpMessage(data: any) {
  const mcpMessage: McpMessage = {
    messageType: data.messageType || 'UNKNOWN',
    content: data.content || '',
    toolInfo: data.toolInfo,
    currentStep: data.currentStep,
    isFinal: data.isFinal,
    timestamp: new Date().toLocaleTimeString()
  };
  
  // 调试信息
  console.log('MCP Message:', mcpMessage);
  
  mcpMessages.value.push(mcpMessage);
  mcpStats.value.messageCount++;
  
  // 更新步数统计
  if (data.currentStep && data.currentStep > mcpStats.value.stepCount) {
    mcpStats.value.stepCount = data.currentStep;
  }
  
  // 更新工具调用统计
  if (data.messageType === 'TOOL_EXECUTION_START') {
    mcpStats.value.toolCallCount++;
  }
  
  // 如果是最终消息，停止计时器
  if (data.isFinal && mcpDurationTimer) {
    clearInterval(mcpDurationTimer);
    mcpDurationTimer = null;
  }
  
  return mcpMessage;
}

function autoGrowInput() {
  if (!inputEl.value) return;
  const el = inputEl.value;
  el.style.height = 'auto';
  const next = Math.min(el.scrollHeight, props.maxInputPx);
  el.style.height = `${next}px`;
  measureAndEmit('input');
}

function splitSentences(buffer: string) {
  const completed: string[] = [];
  let current = '';
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '.' && buffer.slice(i, i + 3) === '...') {
      current += '...';
      i += 2;
      // 检查省略号后是否有内容，如果有则作为句子边界
      if (i + 1 < buffer.length && buffer[i + 1].trim()) {
        completed.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
    const isBoundary = ch === '。' || ch === '！' || ch === '？' || ch === '!' || ch === '?' || ch === '.';
    if (isBoundary) {
      completed.push(current);
      current = '';
    }
  }
  return { completed, remainder: current };
}

async function postTtsIfEnabled(text: string) {
  try {
    const cfg = props.ttsConfig;
    if (!cfg || !cfg.enabled || !cfg.endpoint) return;
    // 中断上一次仍在进行的 TTS 请求
    if (ttsAbortController) {
      try { ttsAbortController.abort(); } catch {}
    }
    ttsAbortController = new AbortController();
    // Translate only for TTS if enabled; keep UI/chat text unchanged
    let ttsText = text;
    if (props.translation && props.translation.enabled && props.translation.endpoint) {
      try {
        const form = new URLSearchParams();
        form.set('from', props.translation.from || 'zh');
        form.set('to', props.translation.to || 'ja');
        if (props.translation.apiKey) form.set('apikey', props.translation.apiKey);
        if (props.translation.appId) form.set('appid', props.translation.appId);
        form.set('src_text', text);
        const tr = await fetch(props.translation.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
        if (tr.ok) {
          const data = await tr.json();
          const tgt = (data && (data.tgt_text || data.tgtText || data.trans_text)) as string | undefined;
          if (tgt) ttsText = tgt;
        }
      } catch {}
    }
    const body = { ...(cfg.params || {}), text: ttsText , baseUrl:cfg.endpoint};
    console.log(JSON.stringify(body))
    const res = await fetch(`${props.apiBase}/character/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ttsAbortController.signal
    });
    console.log(res)
    } catch (e) {
    console.error(e)
  }
}

function renderCurrentSentenceTypewriter() {
  if (props.mode !== 'compact') return;
  if (typeTimer) { window.clearInterval(typeTimer); typeTimer = null; }
  if (currentIndex.value < 0) return;
  const text = (sentences.value[currentIndex.value] || '').trim();
  let pos = 0;
  assistantBubbleText.value = '';
  typeTimer = window.setInterval(() => {
    if (pos >= text.length) {
      if (typeTimer) { window.clearInterval(typeTimer); typeTimer = null; }
      return;
    }
    assistantBubbleText.value += text[pos++];
    messagesEl.value && (messagesEl.value.scrollTop = messagesEl.value.scrollHeight);
    measureAndEmit();
  }, TYPE_SPEED) as unknown as number;
}

function showIndex(nextIdx: number) {
  if (props.mode !== 'compact') return;
  const maxIdx = sentences.value.length - 2; // exclude remainder
  if (nextIdx < 0 || nextIdx > maxIdx) return;
  currentIndex.value = nextIdx;
  renderCurrentSentenceTypewriter();
  if (!playedTtsIndices.value.has(currentIndex.value)) {
    const s = (sentences.value[currentIndex.value] || '').trim();
    if (s) { playedTtsIndices.value.add(currentIndex.value); postTtsIfEnabled(s); }
  }
}
function showNext() { showIndex(currentIndex.value + 1); }
function showPrev() { showIndex(currentIndex.value - 1); }

function fastForwardCurrent() {
  if (props.mode !== 'compact') return;
  if (currentIndex.value < 0) return;
  if (typeTimer) { window.clearInterval(typeTimer); typeTimer = null; }
  assistantBubbleText.value = (sentences.value[currentIndex.value] || '').trim();
  messagesEl.value && (messagesEl.value.scrollTop = messagesEl.value.scrollHeight);
  measureAndEmit();
}

async function sendMessage() {
  if (!inputEl.value) return;
  let text = inputEl.value.value.trim();
  if (!text) return;
  if (props.mode === 'compact') {
    assistantBubbleText.value = '';
    sentences.value = [''];
    currentIndex.value = -1;
    // 关键修复：每次开始新的对话时清空已播放 TTS 的索引集合，
    // 否则索引从 0 重新计数会命中旧记录，导致后续不再触发 TTS。
    playedTtsIndices.value.clear();
  }
  
  // 重置 MCP 状态
  if (props.mcpEnabled) {
    resetMcpState();
    startMcpTimer();
  }
  
  sendDisabled.value = true;
  inputEl.value.value = '';
  autoGrowInput();

  // Prepare for streaming
  if (props.mode === 'full') {
    historyCache.value.push({ role: 'user', text });
    // make window include tail immediately
    const currentWindow = Math.max(historyLoadedEnd.value - historyLoadedStart.value, historyPageSize);
    historyLoadedEnd.value = historyCache.value.length;
    historyLoadedStart.value = Math.max(0, historyLoadedEnd.value - currentWindow);
    await nextTick();
    messagesEl.value && (messagesEl.value.scrollTop = messagesEl.value.scrollHeight);
  }

  const useMcp = !!props.mcpEnabled && props.mode === 'full'; // 只在full模式下启用MCP
  const endpoint = useMcp ? `${props.apiBase}/agent/tool/executeStream` : endpointNormal.value;
  
  try {
    let res;
    if (useMcp) {
      // MCP 使用 POST 请求，发送 FormData
      const formData = new FormData();
      formData.append('message', text);
      res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'text/event-stream, application/stream+json, application/x-ndjson, */*' },
        cache: 'no-cache'
      });
    } else {
      // 普通请求使用原来的方式
      const url = `${endpoint}?message=${encodeURIComponent(text)}`;
      res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream, application/stream+json, application/x-ndjson, */*' },
        cache: 'no-cache'
      });
    }
    if (!res.ok || !res.body) throw new Error('请求失败');
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const isSse = ct.includes('text/event-stream');
    const isNdjson = ct.includes('application/stream+json') || ct.includes('application/x-ndjson');

    const handleDelta = (delta: string) => {
      if (!delta) return;
      if (props.mode === 'compact') {
        let lastIdx = sentences.value.length - 1;
        const merged = (sentences.value[lastIdx] || '') + delta;
        const seg = splitSentences(merged);
        for (const s of seg.completed) {
          sentences.value[lastIdx] = s;
          sentences.value.push('');
          lastIdx = sentences.value.length - 1;
        }
        sentences.value[sentences.value.length - 1] = seg.remainder;
        const maxCompletedIndex = sentences.value.length - 2;
        if (currentIndex.value === -1 && maxCompletedIndex >= 0) {
          currentIndex.value = 0;
          renderCurrentSentenceTypewriter();
          // Ensure first sentence triggers TTS once it becomes visible automatically
          const first = (sentences.value[0] || '').trim();
          if (first && !playedTtsIndices.value.has(0)) {
            playedTtsIndices.value.add(0);
            postTtsIfEnabled(first);
          }
        }
      } else {
        // full mode: append assistant text
        const last = historyCache.value[historyCache.value.length - 1];
        if (!last || last.role !== 'assistant') {
          historyCache.value.push({ role: 'assistant', text: delta });
        } else {
          last.text += delta;
        }
        // keep the window pinned to tail
        const currentWindow = Math.max(historyLoadedEnd.value - historyLoadedStart.value, historyPageSize);
        historyLoadedEnd.value = historyCache.value.length;
        historyLoadedStart.value = Math.max(0, historyLoadedEnd.value - currentWindow);
      }
      // Force immediate UI update and scroll
      nextTick(() => {
        messagesEl.value && (messagesEl.value.scrollTop = messagesEl.value.scrollHeight);
        measureAndEmit();
      });
    };

    const handleMcpData = (data: any) => {
      const mcpMessage = handleMcpMessage(data);
      
      // 如果有实际内容，也按原来的方式处理
      if (data.content && data.content.trim() && ['AGENT_FINISHED'].includes(data.messageType)) {
        handleDelta(data.content);
      }
      
      // 如果启用了 MCP，按step创建独立的消息
      if (useMcp && props.mode === 'full') {
        const stepNum = data.currentStep || 0;
        
        // 为每个新的step创建独立的消息
        if (data.messageType === 'STEP_START' || (stepNum > 0 && !mcpSteps.value.has(stepNum))) {
          // 创建新的step消息
          const stepTitle = stepNum > 0 ? `步骤 ${stepNum}` : '开始执行';
          historyCache.value.push({ 
            role: 'assistant', 
            text: stepTitle, 
            mcpMessages: [] 
          });
          
          // 初始化step消息数组
          mcpSteps.value.set(stepNum, []);
          
          // 更新窗口位置
          const currentWindow = Math.max(historyLoadedEnd.value - historyLoadedStart.value, historyPageSize);
          historyLoadedEnd.value = historyCache.value.length;
          historyLoadedStart.value = Math.max(0, historyLoadedEnd.value - currentWindow);
        }
        
        // 将消息添加到对应的step中
        if (mcpSteps.value.has(stepNum)) {
          mcpSteps.value.get(stepNum)!.push(mcpMessage);
          
          // 找到对应的step消息并更新
          for (let i = historyCache.value.length - 1; i >= 0; i--) {
            const item = historyCache.value[i];
            if (item.role === 'assistant' && 
                (item.text === `步骤 ${stepNum}` || (stepNum === 0 && item.text === '开始执行'))) {
              if (!item.mcpMessages) item.mcpMessages = [];
              item.mcpMessages = [...mcpSteps.value.get(stepNum)!];
              break;
            }
          }
        }
        
        // 如果是最终消息，创建结果消息
        if (data.isFinal && data.messageType === 'AGENT_FINISHED') {
          historyCache.value.push({ 
            role: 'assistant', 
            text: '任务完成', 
            mcpMessages: [] 
          });
          
          // 更新窗口位置
          const currentWindow = Math.max(historyLoadedEnd.value - historyLoadedStart.value, historyPageSize);
          historyLoadedEnd.value = historyCache.value.length;
          historyLoadedStart.value = Math.max(0, historyLoadedEnd.value - currentWindow);
        }
      }
      
      // Force immediate UI update and scroll
      nextTick(() => {
        messagesEl.value && (messagesEl.value.scrollTop = messagesEl.value.scrollHeight);
        measureAndEmit();
      });
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      if (useMcp) {
        // MCP 流式处理：直接解析 JSON 对象或 SSE 格式
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          try {
            // 直接解析 JSON 对象
            const data = JSON.parse(trimmedLine);
            console.log('MCP Raw Data:', data);
            handleMcpData(data);
          } catch (error) {
            // 尝试 SSE 格式解析 - 支持 "data:" 和 "data: " 两种格式
            if (trimmedLine.startsWith('data:')) {
              const jsonStr = trimmedLine.startsWith('data: ') 
                ? trimmedLine.substring(6).trim()  // "data: " 格式
                : trimmedLine.substring(5).trim(); // "data:" 格式
                
              if (jsonStr === '[DONE]') {
                // 处理完成信号
                console.log('MCP Stream Done');
                continue;
              }
              
              try {
                const data = JSON.parse(jsonStr);
                console.log('MCP SSE Data:', data);
                handleMcpData(data);
              } catch (innerError) {
                console.error('MCP SSE 解析失败:', innerError, jsonStr);
              }
            } else {
              console.log('MCP Unknown Format:', trimmedLine);
            }
          }
        }
      } else {
        // 原有的流式处理逻辑
        if (isSse) {
          const parts = buffer.split(/\n\n|\r\n\r\n/);
          buffer = parts.pop() || '';
          for (const block of parts) {
            const lines = block.split(/\r?\n/);
            for (const line of lines) {
              if (!line) continue;
              if (line.startsWith('data:')) {
                const payload = line.slice(5).trim();
                if (payload.startsWith('{')) {
                  try {
                    const obj = JSON.parse(payload);
                    const textField = (obj?.result?.output?.text ?? obj?.text ?? obj?.response ?? '') as string;
                    if (textField) handleDelta(textField);
                  } catch {}
                }
              }
            }
          }
        } else if (isNdjson) {
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              const textField = (obj?.result?.output?.text ?? obj?.text ?? obj?.response ?? '') as string;
              if (textField) handleDelta(textField);
            } catch {}
          }
        } else {
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              const textField = (obj?.result?.output?.text ?? obj?.text ?? obj?.response ?? '') as string;
              if (textField) handleDelta(textField);
            } catch {
              handleDelta(line);
            }
          }
        }
      }
    }
    // 流式结束：full 模式下将本次完整助手回复送入 TTS
    if (props.mode === 'full') {
      // 从尾部寻找最近一条助手消息（即本次回复）
      let idx = historyCache.value.length - 1;
      while (idx >= 0 && historyCache.value[idx].role !== 'assistant') idx--;
      if (idx >= 0) {
        const fullText = (historyCache.value[idx].text || '').trim();
        if (fullText) postTtsIfEnabled(fullText);
      }
    }
  } catch (e) {
    if (props.mode === 'full') {
      historyCache.value.push({ role: 'assistant', text: `[错误] ${(e as Error)?.message || '请求异常'}` });
    } else {
      assistantBubbleText.value = `[错误] ${(e as Error)?.message || '请求异常'}`;
    }
  } finally {
    sendDisabled.value = false;
  }
}

async function loadHistoryFromApi() {
  try {
    const res = await fetch(endpointHistory.value, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-cache' });
    if (!res.ok) throw new Error('history request failed');
    const arr = await res.json();
    historyCache.value = Array.isArray(arr) ? arr.map((it: any) => ({
      role: (String(it.messageType || '').toLowerCase() === 'user') ? 'user' : 'assistant',
      text: (() => {
        const t = it.textContent;
        try { const obj = JSON.parse(t); return (obj?.result?.output?.text ?? obj?.text ?? obj?.response ?? t) as string; } catch { return t; }
      })()
    })) : [];
    const len = historyCache.value.length;
    historyLoadedEnd.value = len;
    historyLoadedStart.value = Math.max(0, len - historyPageSize);
  } catch {}
}

function canLoadMoreHistory() { return historyLoadedStart.value > 0; }
function loadMoreHistoryUp() {
  if (!canLoadMoreHistory()) return;
  const newStart = Math.max(0, historyLoadedStart.value - historyPageSize);
  historyLoadedStart.value = newStart;
}

function onMessagesScroll(e: Event) {
  if (props.mode !== 'full') return;
  const el = e.target as HTMLElement;
  if (el.scrollTop <= 0) {
    const prevHeight = el.scrollHeight;
    loadMoreHistoryUp();
    nextTick(() => {
      // keep position
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeight;
    });
  }
}

function scrollToBottom() {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
      }
    });
  });
}

function onMessagesClick() {
  if (props.mode !== 'compact') return;
  
  // compact模式下不允许文本选择，直接处理点击事件
  const maxIdx = sentences.value.length - 2;
  if (currentIndex.value < 0 && maxIdx >= 0) {
    showIndex(0);
  } else if (typeTimer) {
    fastForwardCurrent();
  } else {
    showNext();
  }
}

function onMessagesWheel(e: WheelEvent) {
  if (props.mode !== 'compact') return;
  e.preventDefault();
  if (typeTimer) {
    fastForwardCurrent();
    return;
  }
  if (e.deltaY < 0) showPrev();
  else if (e.deltaY > 0) showNext();
}

defineExpose({
  getHistory(): string[] {
    if (props.mode !== 'compact') return [];
    const maxCompleted = sentences.value.length - 2;
    const out: string[] = [];
    for (let i = 0; i <= maxCompleted; i++) out.push((sentences.value[i] || '').trim());
    return out.filter(Boolean);
  }
});

onMounted(async () => {
  if (props.mode === 'full') {
    await loadHistoryFromApi();
    // position at bottom initially
    historyLoadedEnd.value = historyCache.value.length;
    historyLoadedStart.value = Math.max(0, historyLoadedEnd.value - historyPageSize);
    scrollToBottom();
    // also after dialog transition
    setTimeout(() => scrollToBottom(), 150);
  }
  autoGrowInput();
  measureAndEmit();
  
  // 注册消息处理函数并确保全局 WebSocket 连接
  console.log(`AIChatPanel (${props.mode}) 组件挂载，注册消息处理函数`);
  (window as any).chatWebSocketManager.registerMessageHandler(handlePassiveMessage);
  (window as any).chatWebSocketManager.connectGlobalWebSocket(props.apiBase);
});

// When tail grows, keep pinned to bottom (won't trigger on top paging)
watch(() => historyLoadedEnd.value, () => { if (props.mode === 'full') scrollToBottom(); });

onBeforeUnmount(() => {
  if (typeTimer) { window.clearInterval(typeTimer); typeTimer = null; }
  if (mcpDurationTimer) { clearInterval(mcpDurationTimer); mcpDurationTimer = null; }
  
  // 取消注册消息处理函数（但不关闭全局 WebSocket 连接）
  console.log(`AIChatPanel (${props.mode}) 组件销毁，取消注册消息处理函数`);
  (window as any).chatWebSocketManager.unregisterMessageHandler(handlePassiveMessage);
});

watch(() => props.mcpEnabled, () => { /* no-op, picked up on next send */ });

function onEnterKey(e: KeyboardEvent) {
  if (e.shiftKey) return;
  sendMessage();
}

function getMessageTypeLabel(messageType: string): string {
  const labels: Record<string, string> = {
    'AGENT_START': '🤖 开始执行',
    'STEP_START': '📝 开始步骤',
    'THINKING_START': '🤔 开始思考',
    'THINKING_RESULT': '💡 思考结果',
    'TOOL_SELECTED': '🔧 选择工具',
    'TOOL_EXECUTION_START': '⚡ 执行工具',
    'TOOL_EXECUTION_RESULT': '✅ 工具结果',
    'STEP_COMPLETE': '✨ 步骤完成',
    'AGENT_FINISHED': '🎉 任务完成',
    'AGENT_ERROR': '❌ 执行错误',
    'TASK_TERMINATED': '🛑 任务终止'
  };
  return labels[messageType] || messageType;
}

function onContextMenu() {
  // 允许默认的右键菜单行为，方便复制文本
  // 不需要阻止默认行为
}

function processTextEscapes(text: string): string {
  if (!text) return '';
  
  // 处理常见的转义序列
  // 先处理双反斜杠，避免误处理
  let result = text
    .replace(/\\\\/g, '\u0001BACKSLASH\u0001')  // 临时标记真正的反斜杠
    .replace(/\\n/g, '\n')                      // 替换换行符
    .replace(/\\t/g, '\t')                      // 替换制表符
    .replace(/\\"/g, '"')                       // 替换引号
    .replace(/\u0001BACKSLASH\u0001/g, '\\');   // 恢复真正的反斜杠
  
  return result;
}

</script>

<template>
  <div class="chat-root" ref="rootEl">
    <div class="messages" ref="messagesEl" @scroll="onMessagesScroll" @click="onMessagesClick" @wheel.passive="false" @wheel="onMessagesWheel" @contextmenu="onContextMenu">
      <template v-if="mode === 'compact'">
        <div class="msg assistant center">
          <div class="bubble compact">{{ processTextEscapes(assistantBubbleText) }}</div>
        </div>
      </template>
      <template v-else>
        <template v-for="item in historyCache.slice(historyLoadedStart, historyLoadedEnd)" :key="item.text + item.role">
            <div class="msg" :class="item.role">
              <q-avatar v-if="item.role === 'assistant'" size="30px">
                <img :src="assistantAvatarUrl">
              </q-avatar>
              <div class="bubble">
                {{ processTextEscapes(item.text) }}
                
                <!-- MCP 消息详情 -->
                <div v-if="item.mcpMessages && item.mcpMessages.length > 0" class="mcp-details">
                  <div class="mcp-messages">
                    <div v-for="(mcpMsg, mcpIdx) in item.mcpMessages" :key="mcpIdx" 
                         class="mcp-message" :class="mcpMsg.messageType.toLowerCase()">
                      <div class="mcp-message-line">
                        <span class="mcp-message-type">{{ getMessageTypeLabel(mcpMsg.messageType) }}</span>
                        <span class="mcp-message-content">{{ processTextEscapes(mcpMsg.content) }}</span>
                      </div>
                      <div v-if="mcpMsg.toolInfo" class="mcp-tool-info">{{ mcpMsg.toolInfo }}</div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </template>
      </template>
    </div>
    <div class="footer">
      <div class="textarea-wrap">
        <textarea ref="inputEl" :placeholder="'输入消息，Enter 发送，Shift+Enter 换行'" @input="autoGrowInput" @keydown.enter.prevent="onEnterKey"></textarea>
        <button class="send-fab" :disabled="sendDisabled" @click="sendMessage">
          <span v-if="sendDisabled" class="spinner"></span>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 6px;
  background: var(--bg, #ffffff);
  border-radius: var(--radius, 10px);
}
.messages {
  flex: 1;
  overflow: auto;
  padding: 8px;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 8px;
  background: #fafafa;
}
.msg { margin: 6px 0; display: flex; gap: 8px; align-items: flex-start; }
.msg.user { justify-content: flex-end; }
.msg.assistant.center { justify-content: center; }
.avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; background-size: cover; background-position: center; }
.bubble { max-width: 85%; padding: 8px 10px; border-radius: 10px; background: #fff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 1px 3px rgba(0,0,0,0.05); white-space: pre-wrap; word-break: break-word; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; }
.bubble.compact { background: transparent; border: none; box-shadow: none; padding: 0; max-width: 90%; text-align: center; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
.footer { display: flex; align-items: flex-end; gap: 8px; margin-top: 8px; }
.textarea-wrap { flex: 1; position: relative; }
textarea { width: 100%; min-height: 20px; height: 20px; max-height: 120px; resize: none; padding: 8px 10px; line-height: 20px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); outline: none; background: #fff; color: #1f1f1f; overflow: auto; }
textarea:disabled { background: #f5f5f5; color: #999; }
.send-fab { position: absolute; right: 8px; bottom: 8px; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #3f51b5; color: #fff; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
.send-fab:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.6); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Thin scrollbars */
.messages::-webkit-scrollbar { width: 4px; }
.messages::-webkit-scrollbar-track { background: transparent; }
.messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.25); border-radius: 2px; }

/* MCP 相关样式 */
.mcp-details {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid #e9ecef;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

.mcp-messages {
  max-height: 200px;
  overflow-y: auto;
}

.mcp-message {
  margin-bottom: 6px;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
}

.mcp-message:last-child {
  border-bottom: none;
}

.mcp-message-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 2px;
}

.mcp-message-type {
  font-weight: bold;
  color: #495057;
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
}

.mcp-message-content {
  color: #333;
  font-size: 11px;
  line-height: 1.4;
  flex: 1;
  word-break: break-word;
}

.mcp-tool-info {
  margin-top: 4px;
  padding: 4px 6px;
  background: #e9ecef;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
  color: #6c757d;
  word-break: break-all;
}
</style>


