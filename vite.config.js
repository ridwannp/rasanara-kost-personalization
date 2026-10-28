import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { vitePluginDeepseek } from './src/server/vitePluginDeepseek.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginDeepseek()],
})
