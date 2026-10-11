import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// В dev-режиме API проксируется на локальный backend, поэтому в коде клиента нет абсолютных URL.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' } },
});
