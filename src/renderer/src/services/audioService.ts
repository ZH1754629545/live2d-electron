import { Howl } from 'howler';

// 音频缓存，避免重复加载
const audioCache: Record<string, Howl> = {};

// 全局音量设置
let globalVolume = 0.5; // 默认音量 0%

/**
 * 设置全局音量
 * @param volume 音量值 (0-1)
 */
export function setGlobalVolume(volume: number): void {
  globalVolume = Math.max(0, Math.min(1, volume));
  
  // 更新所有已加载音频的音量
  Object.values(audioCache).forEach(sound => {
    sound.volume(globalVolume);
  });
}

/**
 * 获取当前全局音量
 * @returns 当前音量值 (0-1)
 */
export function getGlobalVolume(): number {
  return globalVolume;
}

/**
 * 播放系统音频
 * @param audioName 音频名称，对应 audioMapping 中的键
 * @param volume 可选，单独设置此音频的音量 (0-1)，不设置则使用全局音量
 * @returns Promise，音频播放完成后 resolve
 */
export async function playSystemAudio(audioName: string): Promise<void> {
  try {
    const audioPath = await window.electron.ipcRenderer.invoke('get-system-audio-path', audioName);
    
    // 异步获取音量并更新
    const volume = await window.electron.ipcRenderer.invoke('get-system-audio-volume');
    if (volume !== undefined) {
      setGlobalVolume(volume);
    }
    if(globalVolume===0){
      return;
    }
    console.log('playSystemAudio:', audioPath, audioName);
    if (audioPath.startsWith('找不到')) {
      throw new Error(audioPath);
    }

    // 初始化或更新 Howl 实例
    if (!audioCache[audioName]) {
      audioCache[audioName] = new Howl({
        src: [audioPath],
        volume: globalVolume,
        preload: true,
        html5: true
      });
    } else {
      audioCache[audioName].volume(globalVolume);
    }

    const sound = audioCache[audioName];
    
    // 封装播放操作为 Promise
    const playPromise = new Promise<void>((resolve, reject) => {
      sound.once('end', () => resolve());
      sound.once('loaderror', (_, err) => reject(new Error(`音频加载失败: ${err}`)));
      sound.once('playerror', (_, err) => reject(new Error(`音频播放失败: ${err}`)));
    });

    stopAllAudio();
    console.log('start play:', audioName);
    sound.play();

    await playPromise;
  } catch (error) {
    console.error('播放音频时发生错误:', error);
    throw error;
  }
}

/**
 * 停止播放指定音频
 * @param audioName 音频名称
 */
export function stopSystemAudio(audioName: string): void {
  if (audioCache[audioName]) {
    audioCache[audioName].stop();
  }
}

/**
 * 停止所有音频
 */
export function stopAllAudio(): void {
  Object.values(audioCache).forEach(sound => {
    sound.stop();
  });
}

/**
 * 释放音频资源
 * @param audioName 音频名称，不提供则释放所有
 */
export function unloadAudio(audioName?: string): void {
  if (audioName && audioCache[audioName]) {
    audioCache[audioName].unload();
    delete audioCache[audioName];
  } else if (!audioName) {
    Object.values(audioCache).forEach(sound => {
      sound.unload();
    });
    Object.keys(audioCache).forEach(key => {
      delete audioCache[key];
    });
  }
}