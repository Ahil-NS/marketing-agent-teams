import {defineConfig} from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/commands/**/*.ts', 'src/hooks/**/*.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
})
