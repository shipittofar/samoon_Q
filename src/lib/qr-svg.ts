import QRCode from 'qrcode'
import { isEncodableQrUrl } from '@/lib/qr-url'

/** Encode `qr.url` as SVG. Passes the string through unchanged. */
export async function encodeQrSvg(url: string): Promise<string> {
  if (!isEncodableQrUrl(url)) {
    throw new Error('invalid_qr_url')
  }
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}
