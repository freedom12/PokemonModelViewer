import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// 记录应用启动时间
const startTime = performance.now()

const app = createApp(App)

// 监听应用挂载完成
app.mount('#app')

// 计算并记录加载时间
const loadTime = performance.now() - startTime
console.log(`🚀 应用初始加载完成，耗时: ${loadTime.toFixed(2)}ms`)
