import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cores do manifesto = tokens "tinta" e "papel" de src/styles/tokens.css.
const INK = '#141414';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Separa dependências pesadas em chunks próprios (melhor cache).
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // Fontes self-hosted (@fontsource): só os subconjuntos latinos entram no
        // precache (PT/EN/ES); os demais baixam sob demanda se algum dia forem usados.
        globPatterns: ['**/*.{js,css,html,svg}', '**/*-latin-*.woff2', '**/*-latin-ext-*.woff2'],
        navigateFallbackDenylist: [/^\/__/],
      },
      manifest: {
        id: '/',
        name: 'MangaList',
        short_name: 'MangaList',
        description: 'Seu catálogo pessoal de mangás e webtoons',
        lang: 'pt-BR',
        dir: 'ltr',
        categories: ['books', 'entertainment', 'lifestyle'],
        start_url: '/',
        scope: '/',
        theme_color: INK,
        background_color: INK,
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        // Share Target — recebe URLs compartilhadas do Chrome mobile
        share_target: {
          action: '/',
          method: 'GET',
          params: { url: 'url', title: 'title', text: 'text' },
        },
      },
    }),
  ],
});
