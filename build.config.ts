import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/cli'],
  declaration: true,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      minify: true,
      target: 'es2022',
    },
  },
  clean: true,
})
