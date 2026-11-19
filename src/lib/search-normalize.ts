/**
 * Search text normalization — Phase L3.
 *
 * Persian/Arabic text arrives in many spellings: Arabic ي/ك vs Persian ی/ک,
 * ة/ۀ, hamza-carrying alefs, ZWNJ (نیم‌فاصله) vs space, tashkeel, and
 * Persian/Arabic-Indic digits. Everything is folded to one canonical form
 * so "پیتزا", "پيتزا" and "پیتزا " match the same menu item.
 */

const CHAR_MAP: Record<string, string> = {
  'ي': 'ی', 'ى': 'ی', 'ئ': 'ی',
  'ك': 'ک',
  'ة': 'ه', 'ۀ': 'ه', 'ہ': 'ه',
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ؤ': 'و',
}

const DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'

/** Canonical lowercase form for matching (never for display). */
export function normalizeSearchText(input: string | null | undefined): string {
  if (!input) return ''
  let s = input.toLowerCase()
  // Zero-width non-joiner / joiner, tatweel → space / nothing.
  s = s.replace(/[‌‍]/g, ' ').replace(/ـ/g, '')
  s = s.replace(/[يىئكةۀہأإآٱؤ]/g, (c) => CHAR_MAP[c] ?? c)
  s = s.replace(/[۰-۹٠-٩]/g, (d) => String(DIGITS.indexOf(d) % 10))
  // Latin accents + Arabic tashkeel (both are combining marks after NFD).
  s = s.normalize('NFD').replace(/\p{M}/gu, '')
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Cross-language aliases so a Persian query finds an English menu and vice
 * versa. Small on purpose — the backend should own a real synonym table.
 */
const ALIAS_GROUPS: string[][] = [
  ['pizza', 'پیتزا'],
  ['burger', 'برگر', 'همبرگر'],
  ['sandwich', 'ساندویچ'],
  ['coffee', 'قهوه', 'espresso', 'اسپرسو', 'latte', 'لاته'],
  ['tea', 'چای'],
  ['salad', 'سالاد'],
  ['pasta', 'پاستا', 'ماکارونی'],
  ['kebab', 'کباب'],
  ['steak', 'استیک'],
  ['dessert', 'دسر', 'cake', 'کیک'],
  ['ice cream', 'بستنی'],
  ['juice', 'آبمیوه', 'اب میوه'],
  ['soup', 'سوپ', 'آش'],
  ['breakfast', 'صبحانه'],
  ['haircut', 'اصلاح', 'کوتاهی مو', 'hair'],
  ['nail', 'ناخن', 'manicure', 'مانیکور'],
  ['facial', 'فیشیال', 'پاکسازی'],
  ['dentist', 'دندانپزشک', 'dental', 'دندان'],
  ['doctor', 'دکتر', 'پزشک', 'clinic', 'کلینیک'],
].map((g) => g.map(normalizeSearchText))

/** The normalized query plus its aliases (deduplicated). */
export function expandSearchTerms(query: string): string[] {
  const q = normalizeSearchText(query)
  if (!q) return []
  const out = new Set([q])
  for (const group of ALIAS_GROUPS) {
    if (group.some((term) => term === q || (q.length >= 3 && term.startsWith(q)))) {
      group.forEach((term) => out.add(term))
    }
  }
  return [...out]
}

/** Whether `text` contains any of the (already normalized) terms. */
export function textMatchesTerms(text: string | null | undefined, terms: readonly string[]): boolean {
  if (!terms.length) return false
  const t = normalizeSearchText(text)
  return t.length > 0 && terms.some((term) => t.includes(term))
}
