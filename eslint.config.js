import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'docs/superpowers/**',
  ],
  rules: {
    'test/no-import-node-test': 'off',
  },
})
