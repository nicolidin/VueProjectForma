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
                find: 'vue-lib-exo-corrected',
                replacement: path.resolve(__dirname, '../../Common/vue-lib-exo-nico-corrected/src')
              }
            ]
          : []
        )]
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "vue-lib-exo-corrected/styles/vue-lib-exo-corrected.scss" as *;
          ` // it's only to get $scss variables like $spacing etc, not to apply components style, we do it in main.ts importing vue-lib-exo-corrected/style.css !
        }
      },
    }
  }
})
