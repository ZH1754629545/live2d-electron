import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 引入Quasar
import { Quasar,Notify } from 'quasar'

// 引入Quasar CSS
import 'quasar/src/css/index.sass'
// 引入Quasar图标
import '@quasar/extras/material-icons/material-icons.css'
import quasarLang from 'quasar/lang/zh-CN'

// 创建应用实例
const app = createApp(App)

// 使用Quasar
app.use(Quasar, {
  plugins: {Notify}, // import Quasar plugins and add here
  lang: quasarLang,
})

// 使用Pinia
app.use(createPinia())

// 挂载应用
app.mount('#app')
