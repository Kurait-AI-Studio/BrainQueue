import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Single source of truth for the app version: package.json. Injected as __APP_VERSION__
// so telemetry's app_version can never drift from the released version again.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
