// vite.config.js
import { defineConfig } from "file:///C:/Users/T480s/OneDrive/Desktop/camet_erp/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/T480s/OneDrive/Desktop/camet_erp/frontend/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { VitePWA } from "file:///C:/Users/T480s/OneDrive/Desktop/camet_erp/frontend/node_modules/vite-plugin-pwa/dist/index.js";
import dotenv from "file:///C:/Users/T480s/OneDrive/Desktop/camet_erp/frontend/node_modules/dotenv/lib/main.js";
dotenv.config();
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Camet ERP",
        short_name: "Camet ERP",
        description: "Camet collection app",
        theme_color: "#451952",
        icons: [
          {
            src: "play_store_64.png",
            sizes: "64x64",
            type: "image/png"
          },
          {
            src: "play_store_512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      // ADD THIS: Configure workbox for your 5.05MB bundle
      workbox: {
        maximumFileSizeToCacheInBytes: 6e6
        // 6MB - accommodates your large bundle
      }
    })
  ],
  resolve: {
    alias: {
      "@": "/src"
      // Ensure alias is set up for '@/'
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxUNDgwc1xcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXGNhbWV0X2VycFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVDQ4MHNcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxjYW1ldF9lcnBcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1Q0ODBzL09uZURyaXZlL0Rlc2t0b3AvY2FtZXRfZXJwL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5cclxuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xyXG5cclxuLy8gTG9hZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSAuZW52IGZpbGVcclxuZG90ZW52LmNvbmZpZygpO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLCBcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiAnQ2FtZXQgRVJQJyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnQ2FtZXQgRVJQJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0NhbWV0IGNvbGxlY3Rpb24gYXBwJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyM0NTE5NTInLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJ3BsYXlfc3RvcmVfNjQucG5nJyxcclxuICAgICAgICAgICAgc2l6ZXM6ICc2NHg2NCcsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICdwbGF5X3N0b3JlXzUxMi5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgfSxcclxuICAgICAgLy8gQUREIFRISVM6IENvbmZpZ3VyZSB3b3JrYm94IGZvciB5b3VyIDUuMDVNQiBidW5kbGVcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA2MDAwMDAwIC8vIDZNQiAtIGFjY29tbW9kYXRlcyB5b3VyIGxhcmdlIGJ1bmRsZVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiAnL3NyYycsIC8vIEVuc3VyZSBhbGlhcyBpcyBzZXQgdXAgZm9yICdALydcclxuICAgIH1cclxuICB9LFxyXG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBc1YsU0FBUyxvQkFBb0I7QUFDblgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUV4QixPQUFPLFlBQVk7QUFHbkIsT0FBTyxPQUFPO0FBR2QsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFVBQ1I7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBO0FBQUEsTUFFQSxTQUFTO0FBQUEsUUFDUCwrQkFBK0I7QUFBQTtBQUFBLE1BQ2pDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSztBQUFBO0FBQUEsSUFDUDtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
