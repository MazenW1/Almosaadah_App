import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

export default defineConfig({
  base: isCapacitor ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    preserveSymlinks: true,
  },
  server: {
    fs: { strict: false },
  },
  optimizeDeps: {
    include: [
      'react-router-dom',
      'react-router',
      '@remix-run/router',
      '@supabase/supabase-js',
      '@supabase/functions-js',
      '@supabase/postgrest-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
      '@supabase/auth-js',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [],
    },
  },
})