import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

export default defineConfig({
  // إذا كان كاباسيتور نستخدم './' ، وإذا كان للدومين نستخدم '/'
  base: isCapacitor ? './' : '/', 
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