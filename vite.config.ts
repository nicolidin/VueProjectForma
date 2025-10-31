import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({mode}) => {
  console.log("mode: ", mode)
  const isDev = mode === 'development';

  return {
    plugins: [vue()],
    resolve: {
      alias: [
        {
          find: '@',
          replacement: path.resolve(__dirname, 'src')
        },
        ...(isDev
          ? [
              {
                find: 'lidin-app-kit',
                replacement: path.resolve(__dirname, '../../../lidin-app-kit/src')
              }
            ]
          : []
        )]
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "lidin-app-kit/styles/lidin-app-kit.scss" as *;
          ` // it's only to get $scss variables like $spacing etc, not to apply components style, we do it in main.ts importing lidin-app-kit/style.css !
        }
      },
    }
  }
})
