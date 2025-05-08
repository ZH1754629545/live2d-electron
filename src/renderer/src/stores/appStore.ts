import { defineStore } from 'pinia'
import { ref } from 'vue'

// 定时器


export const useAppStore = defineStore('app', () => {
  // 当前live2d信息
  const live2d = ref({
    name: "",
    path: "",
    reload: false,
    scale: 0.11,
    draggable: false,
    voices: []
  })

  // 消息框信息
  const message = ref({
    content: "",
    opacity: 0
  })

  // 程序信息
  const config = ref({
    width: 300,
    height: 400,
    scale: 1,
    showBorder: false,
    autoStart: false,
    alwaysOnTop: false,
    systemVolume: 1.0
  })

  // 工具栏状态
  const toolbar = ref({
    visible: false,
    position: 'bottom'
  })

  // 更新live2d信息
  function updateLive2d(data: Partial<typeof live2d.value>) {
    live2d.value = { ...live2d.value, ...data }
  }

  // 更新配置
  function updateConfig(data: Partial<typeof config.value>) {
    config.value = { ...config.value, ...data }
  }

  // 更新工具栏状态
  function updateToolbar(data: Partial<typeof toolbar.value>) {
    toolbar.value = { ...toolbar.value, ...data }
  }
  //更新message
  function updateMessage(data: Partial<typeof message.value>) {
    message.value = {...message.value,...data } 
  }

  return {
    live2d,
    message,
    config,
    toolbar,
    updateLive2d,
    updateConfig,
    updateToolbar,
    updateMessage,
  }
})