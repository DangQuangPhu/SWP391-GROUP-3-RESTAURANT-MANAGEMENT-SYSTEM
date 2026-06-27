import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  envDir: '../',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      allow: [
        '.',
        '/Users/phu/.gemini'
      ]
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
      '^/menu/.*\\.(png|jpe?g|gif|svg|webp)$': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        ws: true,
        changeOrigin: true,
        configure: (proxy, _options) => {
          // Remove Vite's default listeners so they don't log benign
          // EPIPE/ECONNRESET errors on every client disconnect.
          proxy.removeAllListeners('error');
          proxy.removeAllListeners('proxyReqWs');
          proxy.removeAllListeners('open');

          proxy.on('error', (err) => {
            if (err.code !== 'EPIPE' && err.code !== 'ECONNRESET') {
              console.error('WS Proxy Error:', err);
            }
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', () => {
              // Suppress socket errors during abrupt client disconnects
            });
          });
          proxy.on('open', (proxySocket) => {
            proxySocket.on('error', () => {
              // Suppress proxy socket errors during abrupt client disconnects
            });
          });
        }
      }
    }
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});