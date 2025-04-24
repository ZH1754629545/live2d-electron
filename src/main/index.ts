import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { loadConfig, saveConfig, updateWindowConfig } from '../renderer/src/utils/config'
import fs from 'fs'
import path from 'path'

function createWindow(): void {
  // 加载配置
  const config = loadConfig()
  const windowConfig = config.window
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    transparent: windowConfig.transparent,
    frame: windowConfig.frame,
    resizable: true,
    movable: true,
    hasShadow: true, // 添加窗口阴影
    width: windowConfig.width,
    height: windowConfig.height,
    alwaysOnTop: windowConfig.alwaysOnTop,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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
    mainWindow.setPosition(windowConfig.x, windowConfig.y)
  }
  
  // 保存窗口位置和大小
  mainWindow.on('close', () => {
    const [x, y] = mainWindow.getPosition()
    const [width, height] = mainWindow.getSize()
    updateWindowConfig({ width, height, x, y })

  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // 添加自定义拖拽区域处理
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      document.querySelectorAll('canvas').forEach(el => {
        el.style.webkitAppRegion = 'no-drag';
      });
    `);
  });
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

  //窗口拖动
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  ipcMain.on('start-drag', (_, position) => {
    isDragging = true;
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow) {
      dragOffset = {
        x: position.x,
        y: position.y
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
        y: position.y
      }
      let size=mainWindow.getSize(); // 先获取当前窗口大小
      mainWindow.setResizable(false); // 关闭窗口缩放
      mainWindow.setPosition(newX, newY,false);
      mainWindow.setSize(size[0],size[1],false); // 重设尺寸为原始尺寸
      mainWindow.setResizable(true); // 重新开启缩放
    }
  });

  ipcMain.on('end-drag', () => {
    isDragging = false;
  });
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  ipcMain.handle('exit-app', () => {
    app.quit();
  });
  
  // 添加获取模型文件夹的IPC处理程序
  ipcMain.handle('get-model-folders', () => {
    try {
      const modelsPath = path.join(__dirname, '../../src/public/live2d/model');
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
    const modelFolderPath = path.join(__dirname, '../../src/public/live2d/model',folderName);
    
    // 递归查找文件夹中的所有model3.json文件
    const findModel3Files = (dir, fileList = []) => {
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
  ipcMain.handle('update-window-settings', (_, settings) => {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        // 更新窗口设置
        mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
        
        // 更新配置
        const config = loadConfig();
        config.window.alwaysOnTop = settings.alwaysOnTop;
        saveConfig(config);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新窗口设置失败:', error);
      return false;
    }
  });

})

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

