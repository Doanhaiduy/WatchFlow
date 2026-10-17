// ESLint (flat config): TypeScript + hooks React + Next. Lỗi chặn: hooks sai (rules-of-hooks); còn lại cảnh báo để rà dần.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  { ignores: [".next/**", ".next-test/**", ".next-e2e/**", ".next-audit/**", ".next-test-*/**", ".next-dev-*/**", "node_modules/**", "design/**", ".local/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "ref-sources/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "no-undef": "off",
      "no-irregular-whitespace": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-img-element": "off",
      "no-console": ["warn", { allow: ["error", "warn", "debug", "log"] }],
    },
  },
);
