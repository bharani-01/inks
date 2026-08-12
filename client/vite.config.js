import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA is served by Express from client/dist in production.
// In dev, Vite runs on 5173 and proxies /api and /uploads to Express on 3000.
// envDir: '..' ensures Vite reads the single master root .env (d:\printa\.env)
export default defineConfig({
  plugins: [react()],
  base: '/',
  envDir: '..',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
