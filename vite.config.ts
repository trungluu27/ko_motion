import { defineConfig } from 'vitest/config';

export default defineConfig({
  // relative asset URLs, so the build also runs under https://<user>.github.io/<repo>/
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { main: 'index.html', lab: 'lab.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
