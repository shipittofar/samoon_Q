import { describe, it, expect } from 'vitest'
import { encodeQrSvg } from '@/lib/qr-svg'

describe('encodeQrSvg', () => {
  it('returns SVG for an exact https qr.url', async () => {
    const url = 'https://api.example.com/qr/abc12345'
    const svg = await encodeQrSvg(url)
    expect(svg).toMatch(/<svg/i)
  })

  it('returns SVG for a relative /qr/<code> url', async () => {
    const svg = await encodeQrSvg('/qr/abc12345')
    expect(svg).toMatch(/<svg/i)
  })

  it('rejects slug paths instead of encoding them', async () => {
    await expect(encodeQrSvg('/samoon')).rejects.toThrow('invalid_qr_url')
    await expect(encodeQrSvg('/samoon/main')).rejects.toThrow('invalid_qr_url')
  })
})
