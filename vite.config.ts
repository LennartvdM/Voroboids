import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Content-Type': 'application/javascript',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.ts': 'ts',
      },
    },
  },
});
