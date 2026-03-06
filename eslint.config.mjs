import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname
});

const eslintConfig = [
    // Ignore generated / build output
    {
        ignores: ['.next/**', 'next-env.d.ts', 'node_modules/**', 'dist/**', 'build/**']
    },
    ...compat.extends('next/core-web-vitals', 'next/typescript'),
    {
        rules: {
            // TypeScript strict
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            // React
            'react/self-closing-comp': 'warn',
            'react/jsx-curly-brace-presence': ['warn', 'never']
        }
    }
];

export default eslintConfig;
