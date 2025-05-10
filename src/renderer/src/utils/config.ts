import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import {is} from '@electron-toolkit/utils'
// 定义配置接口
export interface WindowConfig {
  width: number
  height: number
  x?: number | null
  y?: number | null
  transparent?: boolean
  frame?: boolean
  alwaysOnTop?: boolean
  roundedCorners?:boolean
}

export interface ModelConfig {
  path: string
  scale: number
  position: {
    x: number
    y: number
  }
}

export interface AppConfig {
  window: WindowConfig
  model: ModelConfig
  behavior?: {
    followMouse?: boolean
    autoHide?: boolean
    autoHideDelay?: number
  }
}

// 默认配置
const defaultConfig: AppConfig = {
  window: {
    width: 500,
    height: 500,
    x: null,
    y: null,
    transparent: true,
    frame: false,
    alwaysOnTop: false
  },
  model: {
    path: '/live2d/model/Tsubaki/Tsubaki.model3.json',
    scale: 0.5,
    position: {
      x: 0,
      y: 0
    }
  },
  behavior: {
    followMouse: true,
    autoHide: false,
    autoHideDelay: 5000
  }
}
//获取appdata路径
export const getAppDataPath = (): string => {
  const appPath = path.dirname(app.getPath('exe'))
  const dataPath = path.join(appPath,'resources' ,'data')
  
  // 确保数据目录存在
  if (!fs.existsSync(dataPath)) {
    try {
      fs.mkdirSync(dataPath, { recursive: true })
    } catch (error) {
      console.error('创建数据目录失败:', error)
      // 如果无法在安装目录创建，回退到userData
      return path.join(app.getPath('userData'), 'data')
    }
  }
  return dataPath;
}
// 获取配置文件路径
export const getConfigPath = (): string => {
  // 检查是否在渲染进程�?
  const appDataPath = getAppDataPath();
  if(is.dev){
    return path.join(__dirname, '../../', 'resources/public/config/config.json');
  }
  return path.join(appDataPath,'public', 'config','config.json');
}

// 读取配置
export const loadConfig = (): AppConfig => {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return { ...defaultConfig, ...configData }
    }
  } catch (error) {
    console.error('读取配置文件失败:', error)
  }
  
  return defaultConfig
}

// 保存配置
export const saveConfig = (config: Partial<AppConfig>): void => {
  try {
    const configPath = getConfigPath()
    const currentConfig = loadConfig()
    const newConfig = { ...currentConfig, ...config }
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2))
    console.log('config file was saved successfully')
  } catch (error) {
    console.error('config file was saved fail:', error)
  }
}

// 更新窗口配置
export const updateWindowConfig = (windowConfig: Partial<WindowConfig>): void => {
  const config = loadConfig()
  config.window = { ...config.window, ...windowConfig }
  saveConfig(config)
}

// 更新模型配置
export const updateModelConfig = (modelConfig: Partial<ModelConfig>): void => {
  const config = loadConfig()
  config.model = { ...config.model, ...modelConfig }
  saveConfig(config)
}