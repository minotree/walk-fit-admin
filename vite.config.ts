import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // Tauri 개발 실행 시 Rust 컴파일 임시 파일(src-tauri) 감시 제외
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  preview: { 
    host: "127.0.0.1", 
    port: 5173, 
    strictPort: true 
  },
});