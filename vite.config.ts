import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'

// لو كان البناء لـ Capacitor (موبايل) نستخدم base = './'
// لو كان البناء لـ GitHub Pages نستخدم base = '/Almosaadah_App/'
const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

export default defineConfig({
  base: isCapacitor ? './' : '/Almosaadah_App/',
  plugins: [
    react(),
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})