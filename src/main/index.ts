import { app, shell, BrowserWindow, ipcMain ,dialog} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getConfigPath, loadConfig, saveConfig, updateWindowConfig,getAppDataPath } from '../renderer/src/utils/config'
import { getTodos ,saveTodos} from '../renderer/src/utils/todo'
import fs from 'fs'
import path from 'path'
import { getAudioPath } from '../renderer/src/utils/systemAudioMapping'
function createWindow(): void {
  // 加载配置
  const config = loadConfig()
  const windowConfig = config.window
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    transparent: windowConfig.transparent,
    frame: windowConfig.frame,
    resizable: true,
    hasShadow: false, // 禁用窗口阴影
    backgroundColor: '#00000000', // 设置完全透明的背景色
    width: windowConfig.width,
    height: windowConfig.height,
    alwaysOnTop: windowConfig.alwaysOnTop,
    show: false,
    roundedCorners:windowConfig.roundedCorners,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      webSecurity: false,
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  })

  // 设置窗口位置（如果配置中有指定）
  if (windowConfig.x !== null && windowConfig.y !== null) {
    mainWindow.setPosition(  windowConfig.x !== undefined ? windowConfig.x : 100, 
      windowConfig.y !== undefined ? windowConfig.y : 100)
  }
  
  // 保存窗口位置和大小
  mainWindow.on('close', () => {
    const [x, y] = mainWindow.getPosition()
    const [width, height] = mainWindow.getSize()
    updateWindowConfig({ width, height, x, y })

  })

    // 添加错误处理和调试信息
    mainWindow.webContents.on('did-fail-load', ( errorCode, errorDescription) => {
      console.error('页面加载失败:', errorCode, errorDescription)
      dialog.showErrorBox('加载失败', `应用加载失败: ${errorDescription}`)
    })
  
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // mainWindow.webContents.openDevTools()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Prevent F11 from toggling fullscreen and block HTML fullscreen
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key?.toUpperCase?.() === 'F11' || input.code === 'F11')) {
      event.preventDefault()
    }
  })
  // If something forces fullscreen, immediately exit
  mainWindow.on('enter-full-screen', () => {
    mainWindow.setFullScreen(false)
  })
  mainWindow.webContents.on('enter-html-full-screen', () => {
    mainWindow.webContents.executeJavaScript(
      "document.exitFullscreen && document.exitFullscreen().catch(()=>{})"
    ).catch(() => {})
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // 添加自定义拖拽区域处理
  // mainWindow.webContents.on('did-finish-load', () => {
  //   mainWindow.webContents.executeJavaScript(`
  //     document.querySelectorAll('canvas').forEach(el => {
  //       el.style.webkitAppRegion = 'no-drag';
  //     });
  //   `);
  // });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  // 添加配置相关IPC
  //getConfig
  ipcMain.handle('get-config', () => {
    return loadConfig()
  })
  createWindow()
  //获取模型路径
  ipcMain.handle('get-model-path',()=>{
    const config=loadConfig();
    const currentModel=config.model.path;
    return path.join(getConfigPath(),'../../','live2d/model',currentModel);
  })
  ipcMain.handle('get-app-data-path',()=>{
      return getAppDataPath();
  })
  //窗口拖动
  //@deprecated
 /* let isDragging = false;
  let dragOffset = { x: 0, y: 0 , width: 0, height: 0};
  ipcMain.on('start-drag', (_, position) => {
    isDragging = true;
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow) {
    const size=mainWindow.getSize(); 

      dragOffset = {
        x: position.x,
        y: position.y,
        width:size[0],
        height:size[1]
      };
    }
  });

  ipcMain.on('drag-window', (_, position) => {
    if (!isDragging) return;
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow) {
      const newX = position.x - dragOffset.x +mainWindow.getPosition()[0];
      const newY = position.y - dragOffset.y +mainWindow.getPosition()[1];
      //更新偏移
      dragOffset = {
        x: position.x,
        y: position.y,
        width:dragOffset.width,
        height:dragOffset.height
      }
      mainWindow.setResizable(false); // 关闭窗口缩放
      mainWindow.setPosition(newX, newY,false);
      mainWindow.setSize(dragOffset.width,dragOffset.height,false); // 重设尺寸为原始尺寸
      mainWindow.setResizable(true); // 重新开启缩放
    }
  });

  ipcMain.on('end-drag', () => {
    isDragging = false;
  });*/
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  ipcMain.handle('exit-app', async() => {

    // 退出应用
    app.quit();
    // app.quit();
  });
  
  // 添加获取模型文件夹的IPC处理程序
  ipcMain.handle('get-model-folders', () => {
    try {
      const modelsPath = path.join(getConfigPath(), '../../','live2d/model');

      const folders = fs.readdirSync(modelsPath).filter(file => {
        return fs.statSync(path.join(modelsPath, file)).isDirectory();
      });
      return folders;
    } catch (error) {
      console.error('获取模型文件夹失败:', error);
      return [];
    }
  });

  // 添加获取模型文件的IPC处理程序
ipcMain.handle('get-model-files', (_, folderName) => {
  try {
    const modelFolderPath = path.join(getConfigPath(), '../../','live2d/model',folderName);
    
    // 递归查找文件夹中的所有model3.json文件
    const findModel3Files = (dir, fileList: string[] = []) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          findModel3Files(filePath, fileList);
        } else if (file.includes('model3.json')) {
          // 获取相对于模型文件夹的路径
          const relativePath = path.relative(modelFolderPath, filePath);
          fileList.push(relativePath.replace(/\\/g, '/'));

        }
      }
      
      return fileList;
    };
    
    return findModel3Files(modelFolderPath);
  } catch (error) {
    console.error('获取模型文件失败:', error);
    return [];
  }
});
  
  // 添加保存配置的IPC处理程序
  ipcMain.handle('save-config', (_, newConfig) => {
    try {
      saveConfig(newConfig);
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      return false;
    }
  });

// 添加更新窗口设置的IPC处理程序
  ipcMain.handle('update-window-settings', (_) => {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        // 重启窗口
        mainWindow.close();
        createWindow();
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新窗口设置失败:', error);
      return false;
    }
  });

  //获取todo信息
  ipcMain.handle('get-todos', () => {
    return getTodos();
  })
  //保存todo
  ipcMain.handle('save-todos', async(_, todos) => {
    return saveTodos(todos);
  })

})
  // 添加音频相关的IPC处理程序
  ipcMain.handle('get-system-audio-volume', () => {
    const config = loadConfig();
    
    // 如果配置中没有音频设置，返回默认值0.5
    return config.system.systemVolume;
  });
  ipcMain.handle('get-system-audio-path', (_,name) => {
    return getAudioPath(name);
  });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {

    app.quit()
  }
    ipcMain.on('save-config', (_, newConfig) => {
      saveConfig(newConfig)
    })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

