import {defineConfig} from 'tsup'
import {cpSync} from 'node:fs'

export default defineConfig({
  entry: ['src/index.ts', 'src/commands/**/*.ts', 'src/hooks/**/*.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  onSuccess: async () => {
    // Copy dashboard static files to dist
    try {
      cpSync('src/dashboard', 'dist/dashboard', {recursive: true})
    } catch {
      // Dashboard files may not exist in all builds
    }
  },
})
