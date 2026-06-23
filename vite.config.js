import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Isolate the big, rarely-changing vendors so they cache independently of app
        // code. The authed app (MainApp) and its on-demand screens are split via
        // React.lazy / dynamic import, so they stay out of the login entry on their own.
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/react')) return 'vendor-react'
        },
      },
    },
  },
})
