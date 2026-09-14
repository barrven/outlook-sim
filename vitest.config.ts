import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    include: ['src/renderer/**/*.test.{ts,tsx}', 'src/main/**/*.test.ts', 'src/shared/**/*.test.ts']
  }
})
