import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@public': new URL('./public', import.meta.url).pathname,
      '@images': new URL('./public/images', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
  },
});
