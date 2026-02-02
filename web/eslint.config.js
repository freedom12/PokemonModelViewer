/**
 * ESLint 配置文件 (ESLint 9.x 新格式)
 * 用于 Vue 3 + TypeScript 项目的代码风格检查
 */
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default [
  // 基础 ESLint 推荐配置
  eslint.configs.recommended,
  
  // TypeScript 推荐配置
  ...tseslint.configs.recommended,
  
  // Vue 3 推荐配置
  ...pluginVue.configs['flat/recommended'],
  
  // 全局忽略配置
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/parsers/generated/**',
      '**/*.d.ts',
      'tools/**'
    ]
  },
  
  // TypeScript 文件配置
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    rules: {
      // ==================== 未使用的导入和变量 ====================
      // 禁止未使用的变量（警告级别）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      
      // ==================== TypeScript 相关规则 ====================
      // 允许使用 any 类型（警告级别）
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // 允许空函数
      '@typescript-eslint/no-empty-function': 'off',
      
      // 允许非空断言
      '@typescript-eslint/no-non-null-assertion': 'off',
      
      // ==================== 通用规则 ====================
      // 使用单引号
      'quotes': ['warn', 'single', { avoidEscape: true }],
      
      // 不要求分号
      'semi': ['warn', 'never'],
      
      // 禁止 console（警告级别，允许 warn 和 error）
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // 禁止 debugger
      'no-debugger': 'warn'
    }
  },
  
  // Vue 文件配置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        // 浏览器全局变量
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        Image: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
      }
    },
    rules: {
      // Vue 相关规则
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      
      // TypeScript 规则
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // 允许 console（Vue 组件中常用于调试）
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }]
    }
  }
]
