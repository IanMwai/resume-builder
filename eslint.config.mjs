// eslint.config.mjs
import js from '@eslint/js';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: ['node_modules', 'build', 'dist'],
  },
  js.configs.recommended,
  {
    plugins: { react },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Common globals across Node and browser
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        document: 'readonly',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'no-unused-vars': 'warn',
    },
  },
];