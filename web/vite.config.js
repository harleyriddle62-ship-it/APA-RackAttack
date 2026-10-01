import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    // Accept the preview proxy's host (rotating sandbox hostname).
    allowedHosts: true,
    proxy: {
      // Single origin: the dev server forwards API calls to the api service.
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
    },
    watch: {
      // Bind mounts don't emit inotify events reliably.
      usePolling: true,
      interval: 300,
    },
  },
});
