import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [
      externalizeDepsPlugin(),
    ]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        "@p": resolve(__dirname),
      }
    },
    plugins: [
      vue({
        template: { transformAssetUrls }
      }),
      // 重新添加Quasar插件
      quasar({
        sassVariables: resolve(__dirname, 'src/renderer/src/assets/quasar-variables.sass')
      })
    ],
  }
})
