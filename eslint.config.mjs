import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        files: ['**/*.{js,mjs,cjs,ts}'], // Specify file patterns
        ignorePatterns: ['dist/**'], // Exclude the dist directory
    },
    { languageOptions: { globals: globals.node } }, // Set global variables
    pluginJs.configs.recommended, // Enable recommended JavaScript rules
    ...tseslint.configs.recommended, // Enable recommended TypeScript rules
    prettierConfig, // Disable conflicting ESLint rules with Prettier
    {
        plugins: {
            prettier: prettierPlugin, // Add the Prettier plugin
        },
        rules: {
            'prettier/prettier': 'warn', // Show Prettier formatting issues as warnings
        },
    },
];
