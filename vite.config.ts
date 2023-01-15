import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        Unocss(),
    ],
    server: {
        host: '0.0.0.0', //ip地址
        port: 3008, //端口号
        open: true //启动后是否自动打开浏览器
    },
    base: process.env.NODE_ENV === 'production' ? 'https://yinglegetu.netlify.app' : '/',
})
