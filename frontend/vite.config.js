import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.warn(`[vite proxy error]: ${err.message}`);
            if (res && !res.headersSent && res.writeHead) {
               res.writeHead(502);
               res.end('Proxy Error');
            }
          });
        }
      },
    },
  },
});
