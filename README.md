# live2d

An Electron application with Vue and TypeScript 
基于Electron,node.js,vue3,vite,quasar,快速开发的桌面应用

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```



## 目前已有功能

通过引入live2d模型将模型显示在窗口上。
工具栏功能：
	设置：包括模型缩放，模型拽动，窗口置顶。
	模型：切换src/public/live2d/model下的模型

​    待办：增删改待办。筛选和排序。每日任务功能。

对话框：每日的天气预报api,和一言api.    

## TODO

#### 系统模块

- [x] 设置功能新增显示窗口边框
- [x] 设置功能新增系统音量调节

#### 待办模块

- [x] 任务筛选和排序需要保存config。

- [x] 修改待办时间逻辑分为开始时间和截至时间。可以全部填写也可以任选一个或者都不选。

- [x] 在列表上显示。的时间如果是今天那么就是今天加时间 

  今天 HH:MM-HH:MM 。如果是明天就是明天加时间。目前仅支持今天明天和后天。如果超过三天则用日期表示如5月1日。超过一年就用年份来表示如2026年5月1日

- [x] 时间排序逻辑修改。分为开始时间排序和截至时间排序。

- [x] 超过截至时间的数据自动放到已完成列表。

- [x] 添加一个每日任务功能。如果添加的待办属性包含设置成为每日任务那么这个任务会每日刷新

- [x] 上边添加一个栏分为全部和每日

### 消息模块

- [x] 显示各个要显示的消息在live2d的下方位置，可设定位置。可手动隐藏或者设置超过一定时间就隐藏。
- [x] 当天第一次启动播放天气。



### 系统语音模块

- [x] 添加系统语音功能。包括退出语音，待办语音，提醒语音

### 



### live2d模块

- [ ] live2d自带的交互的启用
