import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// Type-aware linting (audit N-16, N-61) over src/, tests/, scripts/ and the
// config files, with the type information of tsconfig.tests.json.
export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "release/**", "src/tools/generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        project: "./tsconfig.tests.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Tool handlers and test stubs are async to match the SDK and fetch
      // signatures even when they do not await.
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    // Tests read JSON responses and use vitest's asymmetric matchers
    // (`expect.objectContaining`), which are typed `any`.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
];
