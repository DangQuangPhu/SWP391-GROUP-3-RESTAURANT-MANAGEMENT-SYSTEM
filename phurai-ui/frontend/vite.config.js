import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin: suppress benign ws-proxy noise from terminal.
 * Vite 8 logs "ws proxy error: EPIPE/ECONNRESET" via its internal logger
 * (not through proxy.on('error')), so we intercept process.stderr writes.
 */
function suppressWsProxyNoise() {
  return {
    name: 'suppress-ws-proxy-noise',
    configureServer() {
      const _write = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk, ...args) => {
        const s = typeof chunk === 'string' ? chunk : chunk.toString();
        // Drop lines that are purely benign disconnect noise.
        if (
          s.includes('ws proxy error') ||
          s.includes('ws proxy socket error') ||
          (s.includes('EPIPE') && s.includes('socket.io')) ||
          (s.includes('ECONNRESET') && s.includes('socket.io'))
        ) return true;
        return _write(chunk, ...args);
      };
    },
  };
}

const BENIGN = new Set(['EPIPE', 'ECONNRESET']);

export default defineConfig({
  root: '.',
  envDir: '../',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [react(), suppressWsProxyNoise()],

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
        configure: (proxy) => {
          // Suppress benign disconnect errors at the http-proxy level.
          proxy.on('error', (err) => {
            if (!BENIGN.has(err.code)) {
              console.error('[socket.io proxy] error:', err.message);
            }
          });
          proxy.on('proxyReqWs', (_req, _res, socket) => {
            socket.on('error', () => { /* benign disconnect */ });
          });
          proxy.on('open', (proxySocket) => {
            proxySocket.on('error', (err) => {
              if (!BENIGN.has(err.code)) {
                console.error('[socket.io proxy] socket error:', err.message);
              }
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