import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('app/error.tsx document structure', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/app/error.tsx'), 'utf8')

  it('does not render html or body inside the root layout', () => {
    expect(src).not.toMatch(/<html[\s>]/)
    expect(src).not.toMatch(/<body[\s>]/)
    expect(src).not.toMatch(/<\/html>/)
    expect(src).not.toMatch(/<\/body>/)
  })
})
