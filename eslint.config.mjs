import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react/display-name': 'off',
      'prefer-const': 'error',
    },
  },
  {
    // P9.5.4 Phase J — localization guard rail. Scoped to directories
    // already fully migrated to next-intl (P9.5.3/P9.5.4); flags literal
    // JSX text as a warning (never an error — this must not block
    // legitimate runtime values or fail CI on its own) so a future edit
    // that reintroduces a hardcoded string in these directories is
    // visible in lint output. Not extended repo-wide: the ~120 files
    // documented as remaining work in docs/P9.5.4_LOCALIZATION_AUDIT.md
    // are still legitimately English and would make this rule noise
    // rather than signal there.
    files: [
      'src/components/admin/configuration/**/*.tsx',
      'src/components/admin/platform-admin/**/*.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXText[value=/[A-Za-z]{3,}/]',
          message: "Literal JSX text in an already-localized Console/Platform-admin directory — use useTranslations()/t('key') instead (P9.5.4 Phase J).",
        },
      ],
    },
  },
]

export default eslintConfig
