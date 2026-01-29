import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "Smart Assignment Reminder",
        short_name: "Assignments",
        description: "Never miss your deadlines!",
        theme_color: "#6366f1",
        background_color: "#f4f6fb",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "web-app-manifest-192x192",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "web-app-manifest-512x512",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ]
});
