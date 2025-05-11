import path from 'path';
import { getAppDataPath } from './config'
import {is} from '@electron-toolkit/utils'
// 音频文件映射
export const audioMapping = {
  exit:'exit.wav',
  afternoon:'afternoon.wav',
  morning:'morning.wav',
  noon:'noon.wav',
  openTodo:'openTodo.mp3',
  todoAleart:'todoAleart.mp3',
};

// 获取音频文件的绝对路径
export function getAudioPath(audioName: string): string {
  const audioFileName = audioMapping[audioName] || '';
  if (!audioFileName) return '找不到'+audioName+'音频文件';
  
  // 根据开发环境或生产环境确定路径
  const appDataPath = getAppDataPath()
  if(is.dev){
    return path.join(__dirname, '../../resources/public/audio/system', audioFileName);
  }
  return path.join(appDataPath,'public','audio','systemAudio', audioFileName);
}