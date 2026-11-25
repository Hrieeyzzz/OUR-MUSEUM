import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          react: ["react", "react-dom/client"],
          realtime: ["socket.io-client"],
        },
      },
    },
  },
});
