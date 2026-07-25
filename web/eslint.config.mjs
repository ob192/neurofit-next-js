import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/*
 * eslint-config-next 16 ships native flat configs, so they're spread in
 * directly — no @eslint/eslintrc FlatCompat shim needed (and the shim in fact
 * crashes on this config with a circular-structure error).
 */
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
