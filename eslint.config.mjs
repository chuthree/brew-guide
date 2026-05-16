import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'ios/**',
      'android/**',
      'public/sw*.js',
      'public/workbox-*.js',
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // 重新启用 any 类型检查，但设为警告而不是错误
      '@typescript-eslint/no-explicit-any': 'warn',
      // 🔥 性能优化规则
      // React Hooks 依赖检查 - 防止闭包陷阱和内存泄漏
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // 禁止在 JSX 中使用内联函数（性能杀手）
      'react/jsx-no-bind': [
        'warn',
        {
          allowArrowFunctions: false,
          allowBind: false,
          ignoreRefs: true,
        },
      ],
      // 添加其他有用的规则（不需要类型信息的）
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
      // 避免空的 catch 块
      'no-empty': ['error', { allowEmptyCatch: false }],
      // 确保 console 语句不会进入生产环境
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // 避免不必要的布尔转换
      'no-extra-boolean-cast': 'error',
      // 避免重复的条件
      'no-dupe-else-if': 'error',
    },
  },
];

export default eslintConfig;
