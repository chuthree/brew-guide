import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "ios/**",
      "android/**",
      "public/sw*.js",
      "public/workbox-*.js"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      // 重新启用 any 类型检查，但设为警告而不是错误
      "@typescript-eslint/no-explicit-any": "warn",
      // 重新启用 React Hooks 依赖检查，设为警告以便逐步修复
      "react-hooks/exhaustive-deps": "warn",
      // 添加其他有用的规则（不需要类型信息的）
      "@typescript-eslint/no-unused-expressions": ["error", {
        "allowShortCircuit": true,
        "allowTernary": true,
        "allowTaggedTemplates": true
      }],
      // 避免空的 catch 块
      "no-empty": ["error", { "allowEmptyCatch": false }],
      // 确保 console 语句不会进入生产环境
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      // 避免不必要的布尔转换
      "no-extra-boolean-cast": "error",
      // 避免重复的条件
      "no-dupe-else-if": "error"
    }
  }
];

export default eslintConfig;