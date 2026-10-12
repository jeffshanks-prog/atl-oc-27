import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'ATL OC 27',
        short_name: 'ATL OC 27',
        description: 'Madden 27 offensive coordinator and play-calling system',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The screen-reading engine (~10 MB) is only fetched when someone links a game; cache it then.
        globIgnores: ['tesseract/**', '**/tesseract*.js'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/tesseract/'),
          handler: 'CacheFirst',
          options: { cacheName: 'ocr-engine', expiration: { maxEntries: 10 } },
        }],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/\.netlify\//],
      },
    }),
  ],
});
