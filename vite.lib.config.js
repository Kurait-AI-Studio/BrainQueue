import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Library build: compiles src/ui into a distributable component bundle (dist-ui/)
// that /design-sync packages and uploads to Claude Design. React stays external.
//   npm run build:ui
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-ui",
    emptyOutDir: true,
    lib: {
      entry: "src/ui/index.js",
      name: "BrainQueueUI",
      formats: ["es", "umd"],
      fileName: (f) => `brainqueue-ui.${f}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: { globals: { react: "React", "react-dom": "ReactDOM", "react/jsx-runtime": "jsxRuntime" } },
    },
  },
});
