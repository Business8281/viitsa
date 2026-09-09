import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  // SPA fallback so /patient route serves index.html
  server: {
    historyApiFallback: true,
  },
  // Build output for SPA — all routes serve index.html
  preview: {
    // historyApiFallback not in preview, but handled by the host
  },
});
