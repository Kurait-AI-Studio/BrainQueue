import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // rolldown (Vite 8) merges small dynamic-import chunks back into the entry by
        // default, which defeats React.lazy. Force the on-demand screens/modals into their
        // own chunks so they load only when opened, and isolate the big vendors so they
        // cache independently of app code.
        manualChunks(id) {
          if (id.includes('/src/ui/AnalyticsModal')) return 'scr-analytics'
          if (id.includes('/src/ui/FocusSetsScreen')) return 'scr-focus'
          if (id.includes('/src/ui/TaskDetailModal')) return 'scr-task-detail'
          if (id.includes('/src/ui/TaskModal')) return 'scr-task-modal'
          if (id.includes('/src/ui/SettingsModal')) return 'scr-settings'
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/react')) return 'vendor-react'
        },
      },
    },
  },
})
