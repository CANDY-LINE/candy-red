module.exports = {
    root: true,
    env: {
      browser: false,
      node: true,
      es6: true
    },
    parserOptions: {
      parser: 'babel-eslint',
      sourceType: 'module',
      ecmaVersion: 9
    },
    extends: [
      'plugin:prettier/recommended',
      'prettier',
      'eslint:recommended',
    ],
    plugins: [
      'prettier'
    ],
    rules: {
    }
  }
