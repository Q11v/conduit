import js from '@eslint/js'
import globals from 'globals'
import * as oxc from 'eslint-parser-oxc'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier/flat'

export default [
  { ignores: ['node_modules', 'web/dist', 'release'] },

  js.configs.recommended,

  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: oxc,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },

  {
    files: ['server/**/*.js', 'electron/**/*.js', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }]
    }
  },

  {
    files: ['electron/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node }
  },

  {
    files: ['web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react-hooks/set-state-in-effect': 'warn'
    }
  },

  prettier
]
