/**
 * P8.9.2 — Country data for the international phone_number input.
 *
 * Each entry: ISO 3166-1 alpha-2 code, English name, E.164 dial code,
 * and an example national-format placeholder for the number input.
 */

export interface Country {
  code: string       // ISO 3166-1 alpha-2, e.g. 'US'
  name: string       // English display name
  dialCode: string   // e.g. '+1'
  placeholder: string // national-format example shown as input placeholder
}

/** Compute flag emoji from ISO alpha-2 code. */
export function getFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

/**
 * Globally common countries pinned at the top of the picker.
 * Covers ~70% of app users statistically.
 */
export const PINNED_COUNTRY_CODES = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'AE', 'TR', 'IR', 'AZ']

/** @deprecated Use PINNED_COUNTRY_CODES. Kept for backward compatibility. */
export const PREFERRED_COUNTRY_CODES = PINNED_COUNTRY_CODES

/** localStorage key for persisting recently used countries. */
export const RECENT_COUNTRIES_KEY = 'phone_number-input-recent-countries'

/** localStorage key for the last explicitly selected country. */
export const LAST_SELECTED_KEY = 'phone_number-input-last-selected'

/** Max number of recent countries to show (excluding pinned). */
export const MAX_RECENT = 5

export const COUNTRIES: Country[] = [
  // ── Americas ──
  { code: 'US', name: 'United States',          dialCode: '+1',   placeholder: '(201) 555-0123' },
  { code: 'CA', name: 'Canada',                  dialCode: '+1',   placeholder: '(416) 555-0123' },
  { code: 'MX', name: 'Mexico',                  dialCode: '+52',  placeholder: '55 1234 5678' },
  { code: 'BR', name: 'Brazil',                  dialCode: '+55',  placeholder: '11 9 1234-5678' },
  { code: 'AR', name: 'Argentina',               dialCode: '+54',  placeholder: '11 1234-5678' },
  { code: 'CL', name: 'Chile',                   dialCode: '+56',  placeholder: '9 1234 5678' },
  { code: 'CO', name: 'Colombia',                dialCode: '+57',  placeholder: '310 123 4567' },
  { code: 'PE', name: 'Peru',                    dialCode: '+51',  placeholder: '987 654 321' },
  { code: 'VE', name: 'Venezuela',               dialCode: '+58',  placeholder: '0412-1234567' },
  { code: 'EC', name: 'Ecuador',                 dialCode: '+593', placeholder: '099 123 4567' },
  { code: 'BO', name: 'Bolivia',                 dialCode: '+591', placeholder: '71234567' },
  { code: 'PY', name: 'Paraguay',                dialCode: '+595', placeholder: '0981 123456' },
  { code: 'UY', name: 'Uruguay',                 dialCode: '+598', placeholder: '099 123 456' },
  { code: 'GT', name: 'Guatemala',               dialCode: '+502', placeholder: '5123 4567' },
  { code: 'HN', name: 'Honduras',                dialCode: '+504', placeholder: '9123-4567' },
  { code: 'SV', name: 'El Salvador',             dialCode: '+503', placeholder: '7012 3456' },
  { code: 'NI', name: 'Nicaragua',               dialCode: '+505', placeholder: '8123 4567' },
  { code: 'CR', name: 'Costa Rica',              dialCode: '+506', placeholder: '8312 3456' },
  { code: 'PA', name: 'Panama',                  dialCode: '+507', placeholder: '6123-4567' },
  { code: 'CU', name: 'Cuba',                    dialCode: '+53',  placeholder: '5 1234567' },
  { code: 'DO', name: 'Dominican Republic',      dialCode: '+1',   placeholder: '(809) 234-5678' },
  { code: 'PR', name: 'Puerto Rico',             dialCode: '+1',   placeholder: '(787) 234-5678' },
  { code: 'TT', name: 'Trinidad and Tobago',     dialCode: '+1',   placeholder: '(868) 291-1234' },
  { code: 'JM', name: 'Jamaica',                 dialCode: '+1',   placeholder: '(876) 210-1234' },
  { code: 'BB', name: 'Barbados',                dialCode: '+1',   placeholder: '(246) 250-1234' },

  // ── Europe ──
  { code: 'GB', name: 'United Kingdom',          dialCode: '+44',  placeholder: '07911 123456' },
  { code: 'DE', name: 'Germany',                 dialCode: '+49',  placeholder: '0151 12345678' },
  { code: 'FR', name: 'France',                  dialCode: '+33',  placeholder: '06 12 34 56 78' },
  { code: 'IT', name: 'Italy',                   dialCode: '+39',  placeholder: '312 345 6789' },
  { code: 'ES', name: 'Spain',                   dialCode: '+34',  placeholder: '612 345 678' },
  { code: 'PT', name: 'Portugal',                dialCode: '+351', placeholder: '912 345 678' },
  { code: 'NL', name: 'Netherlands',             dialCode: '+31',  placeholder: '06 12345678' },
  { code: 'BE', name: 'Belgium',                 dialCode: '+32',  placeholder: '0471 12 34 56' },
  { code: 'CH', name: 'Switzerland',             dialCode: '+41',  placeholder: '076 123 45 67' },
  { code: 'AT', name: 'Austria',                 dialCode: '+43',  placeholder: '0664 123456' },
  { code: 'SE', name: 'Sweden',                  dialCode: '+46',  placeholder: '070-123 45 67' },
  { code: 'NO', name: 'Norway',                  dialCode: '+47',  placeholder: '406 12 345' },
  { code: 'DK', name: 'Denmark',                 dialCode: '+45',  placeholder: '20 12 34 56' },
  { code: 'FI', name: 'Finland',                 dialCode: '+358', placeholder: '040 1234567' },
  { code: 'PL', name: 'Poland',                  dialCode: '+48',  placeholder: '512 345 678' },
  { code: 'CZ', name: 'Czech Republic',          dialCode: '+420', placeholder: '601 123 456' },
  { code: 'SK', name: 'Slovakia',                dialCode: '+421', placeholder: '98 123 4567' },
  { code: 'HU', name: 'Hungary',                 dialCode: '+36',  placeholder: '30 123 4567' },
  { code: 'RO', name: 'Romania',                 dialCode: '+40',  placeholder: '0712 034 567' },
  { code: 'BG', name: 'Bulgaria',                dialCode: '+359', placeholder: '087 123 4567' },
  { code: 'HR', name: 'Croatia',                 dialCode: '+385', placeholder: '091 234 5678' },
  { code: 'RS', name: 'Serbia',                  dialCode: '+381', placeholder: '060 1234567' },
  { code: 'SI', name: 'Slovenia',                dialCode: '+386', placeholder: '031 234 567' },
  { code: 'GR', name: 'Greece',                  dialCode: '+30',  placeholder: '691 234 5678' },
  { code: 'IE', name: 'Ireland',                 dialCode: '+353', placeholder: '085 012 3456' },
  { code: 'RU', name: 'Russia',                  dialCode: '+7',   placeholder: '8 912 345-67-89' },
  { code: 'UA', name: 'Ukraine',                 dialCode: '+380', placeholder: '067 123 4567' },
  { code: 'BY', name: 'Belarus',                 dialCode: '+375', placeholder: '033 123 45 67' },
  { code: 'LT', name: 'Lithuania',               dialCode: '+370', placeholder: '612 34567' },
  { code: 'LV', name: 'Latvia',                  dialCode: '+371', placeholder: '21 234 567' },
  { code: 'EE', name: 'Estonia',                 dialCode: '+372', placeholder: '5123 4567' },
  { code: 'IS', name: 'Iceland',                 dialCode: '+354', placeholder: '611 1234' },
  { code: 'LU', name: 'Luxembourg',              dialCode: '+352', placeholder: '628 123 456' },
  { code: 'MT', name: 'Malta',                   dialCode: '+356', placeholder: '9696 1234' },
  { code: 'CY', name: 'Cyprus',                  dialCode: '+357', placeholder: '96 123456' },
  { code: 'AL', name: 'Albania',                 dialCode: '+355', placeholder: '066 123 4567' },
  { code: 'MK', name: 'North Macedonia',         dialCode: '+389', placeholder: '072 345 678' },
  { code: 'BA', name: 'Bosnia and Herzegovina',  dialCode: '+387', placeholder: '061 123 456' },
  { code: 'ME', name: 'Montenegro',              dialCode: '+382', placeholder: '067 622 901' },
  { code: 'MD', name: 'Moldova',                 dialCode: '+373', placeholder: '0621 12 345' },
  { code: 'GE', name: 'Georgia',                 dialCode: '+995', placeholder: '555 12 34 56' },
  { code: 'AM', name: 'Armenia',                 dialCode: '+374', placeholder: '077 123456' },
  { code: 'AZ', name: 'Azerbaijan',              dialCode: '+994', placeholder: '040 123 45 67' },

  // ── Middle East ──
  { code: 'AE', name: 'United Arab Emirates',    dialCode: '+971', placeholder: '050 123 4567' },
  { code: 'SA', name: 'Saudi Arabia',            dialCode: '+966', placeholder: '050 123 4567' },
  { code: 'QA', name: 'Qatar',                   dialCode: '+974', placeholder: '3312 3456' },
  { code: 'KW', name: 'Kuwait',                  dialCode: '+965', placeholder: '9123 4567' },
  { code: 'BH', name: 'Bahrain',                 dialCode: '+973', placeholder: '3600 1234' },
  { code: 'OM', name: 'Oman',                    dialCode: '+968', placeholder: '9212 3456' },
  { code: 'YE', name: 'Yemen',                   dialCode: '+967', placeholder: '712 345 678' },
  { code: 'IL', name: 'Israel',                  dialCode: '+972', placeholder: '050-123-4567' },
  { code: 'JO', name: 'Jordan',                  dialCode: '+962', placeholder: '07 9012 3456' },
  { code: 'LB', name: 'Lebanon',                 dialCode: '+961', placeholder: '03 123 456' },
  { code: 'SY', name: 'Syria',                   dialCode: '+963', placeholder: '0944 567 890' },
  { code: 'IQ', name: 'Iraq',                    dialCode: '+964', placeholder: '0770 123 4567' },
  { code: 'IR', name: 'Iran',                    dialCode: '+98',  placeholder: '912 345 6789' },
  { code: 'TR', name: 'Turkey',                  dialCode: '+90',  placeholder: '0532 123 4567' },
  { code: 'PK', name: 'Pakistan',                dialCode: '+92',  placeholder: '0301 2345678' },
  { code: 'AF', name: 'Afghanistan',             dialCode: '+93',  placeholder: '070 123 4567' },

  // ── South & Southeast Asia ──
  { code: 'IN', name: 'India',                   dialCode: '+91',  placeholder: '98765 43210' },
  { code: 'BD', name: 'Bangladesh',              dialCode: '+880', placeholder: '01711-123456' },
  { code: 'LK', name: 'Sri Lanka',               dialCode: '+94',  placeholder: '071 234 5678' },
  { code: 'NP', name: 'Nepal',                   dialCode: '+977', placeholder: '984-1234567' },
  { code: 'MV', name: 'Maldives',                dialCode: '+960', placeholder: '771 2345' },
  { code: 'BT', name: 'Bhutan',                  dialCode: '+975', placeholder: '17 123 456' },
  { code: 'MM', name: 'Myanmar',                 dialCode: '+95',  placeholder: '09 123 4567' },
  { code: 'TH', name: 'Thailand',                dialCode: '+66',  placeholder: '081 234 5678' },
  { code: 'VN', name: 'Vietnam',                 dialCode: '+84',  placeholder: '098 765 4321' },
  { code: 'PH', name: 'Philippines',             dialCode: '+63',  placeholder: '0917 123 4567' },
  { code: 'ID', name: 'Indonesia',               dialCode: '+62',  placeholder: '0812-3456-789' },
  { code: 'MY', name: 'Malaysia',                dialCode: '+60',  placeholder: '012-345 6789' },
  { code: 'SG', name: 'Singapore',               dialCode: '+65',  placeholder: '8123 4567' },
  { code: 'KH', name: 'Cambodia',                dialCode: '+855', placeholder: '091 234 567' },
  { code: 'LA', name: 'Laos',                    dialCode: '+856', placeholder: '020 2345678' },
  { code: 'BN', name: 'Brunei',                  dialCode: '+673', placeholder: '712 3456' },
  { code: 'TL', name: 'Timor-Leste',             dialCode: '+670', placeholder: '7721 2345' },

  // ── East Asia ──
  { code: 'CN', name: 'China',                   dialCode: '+86',  placeholder: '138 1234 5678' },
  { code: 'JP', name: 'Japan',                   dialCode: '+81',  placeholder: '090-1234-5678' },
  { code: 'KR', name: 'South Korea',             dialCode: '+82',  placeholder: '010-1234-5678' },
  { code: 'TW', name: 'Taiwan',                  dialCode: '+886', placeholder: '9 8765 4321' },
  { code: 'HK', name: 'Hong Kong',               dialCode: '+852', placeholder: '9012 3456' },
  { code: 'MO', name: 'Macau',                   dialCode: '+853', placeholder: '6612 3456' },
  { code: 'MN', name: 'Mongolia',                dialCode: '+976', placeholder: '8812 3456' },
  { code: 'KP', name: 'North Korea',             dialCode: '+850', placeholder: '191 123 4567' },

  // ── Central Asia ──
  { code: 'KZ', name: 'Kazakhstan',              dialCode: '+7',   placeholder: '8 701 234 56 78' },
  { code: 'UZ', name: 'Uzbekistan',              dialCode: '+998', placeholder: '90 123 45 67' },
  { code: 'TM', name: 'Turkmenistan',            dialCode: '+993', placeholder: '8 65 123456' },
  { code: 'TJ', name: 'Tajikistan',              dialCode: '+992', placeholder: '917 12 3456' },
  { code: 'KG', name: 'Kyrgyzstan',              dialCode: '+996', placeholder: '0700 123 456' },

  // ── Oceania ──
  { code: 'AU', name: 'Australia',               dialCode: '+61',  placeholder: '0412 345 678' },
  { code: 'NZ', name: 'New Zealand',             dialCode: '+64',  placeholder: '021 234 567' },
  { code: 'FJ', name: 'Fiji',                    dialCode: '+679', placeholder: '701 2345' },
  { code: 'PG', name: 'Papua New Guinea',        dialCode: '+675', placeholder: '681 2345' },
  { code: 'WS', name: 'Samoa',                   dialCode: '+685', placeholder: '720 1234' },
  { code: 'TO', name: 'Tonga',                   dialCode: '+676', placeholder: '771 5123' },
  { code: 'VU', name: 'Vanuatu',                 dialCode: '+678', placeholder: '591 2345' },
  { code: 'SB', name: 'Solomon Islands',         dialCode: '+677', placeholder: '74 21234' },

  // ── Africa ──
  { code: 'NG', name: 'Nigeria',                 dialCode: '+234', placeholder: '0802 123 4567' },
  { code: 'ZA', name: 'South Africa',            dialCode: '+27',  placeholder: '071 123 4567' },
  { code: 'EG', name: 'Egypt',                   dialCode: '+20',  placeholder: '0100 123 4567' },
  { code: 'KE', name: 'Kenya',                   dialCode: '+254', placeholder: '0712 345678' },
  { code: 'GH', name: 'Ghana',                   dialCode: '+233', placeholder: '024 123 4567' },
  { code: 'ET', name: 'Ethiopia',                dialCode: '+251', placeholder: '091 123 4567' },
  { code: 'TZ', name: 'Tanzania',                dialCode: '+255', placeholder: '0712 345 678' },
  { code: 'UG', name: 'Uganda',                  dialCode: '+256', placeholder: '0712 345678' },
  { code: 'MA', name: 'Morocco',                 dialCode: '+212', placeholder: '0612-345678' },
  { code: 'DZ', name: 'Algeria',                 dialCode: '+213', placeholder: '0661 23 45 67' },
  { code: 'TN', name: 'Tunisia',                 dialCode: '+216', placeholder: '22 123 456' },
  { code: 'LY', name: 'Libya',                   dialCode: '+218', placeholder: '091-2345678' },
  { code: 'SD', name: 'Sudan',                   dialCode: '+249', placeholder: '091 123 1234' },
  { code: 'SS', name: 'South Sudan',             dialCode: '+211', placeholder: '0977 123 456' },
  { code: 'SN', name: 'Senegal',                 dialCode: '+221', placeholder: '77 123 45 67' },
  { code: 'CI', name: "Côte d'Ivoire",           dialCode: '+225', placeholder: '07 12 34 56 78' },
  { code: 'CM', name: 'Cameroon',                dialCode: '+237', placeholder: '6 71 23 45 67' },
  { code: 'ML', name: 'Mali',                    dialCode: '+223', placeholder: '65 01 23 45' },
  { code: 'BF', name: 'Burkina Faso',            dialCode: '+226', placeholder: '70 12 34 56' },
  { code: 'NE', name: 'Niger',                   dialCode: '+227', placeholder: '93 12 34 56' },
  { code: 'TD', name: 'Chad',                    dialCode: '+235', placeholder: '63 01 23 45' },
  { code: 'MR', name: 'Mauritania',              dialCode: '+222', placeholder: '22 12 34 56' },
  { code: 'GM', name: 'Gambia',                  dialCode: '+220', placeholder: '301 2345' },
  { code: 'GN', name: 'Guinea',                  dialCode: '+224', placeholder: '601 12 34 56' },
  { code: 'GW', name: 'Guinea-Bissau',           dialCode: '+245', placeholder: '955 012 345' },
  { code: 'SL', name: 'Sierra Leone',            dialCode: '+232', placeholder: '025 123456' },
  { code: 'LR', name: 'Liberia',                 dialCode: '+231', placeholder: '077 012 3456' },
  { code: 'TG', name: 'Togo',                    dialCode: '+228', placeholder: '90 11 23 45' },
  { code: 'BJ', name: 'Benin',                   dialCode: '+229', placeholder: '90 01 12 34' },
  { code: 'GQ', name: 'Equatorial Guinea',       dialCode: '+240', placeholder: '222 123 456' },
  { code: 'GA', name: 'Gabon',                   dialCode: '+241', placeholder: '06 03 12 34' },
  { code: 'CG', name: 'Republic of the Congo',   dialCode: '+242', placeholder: '06 123 4567' },
  { code: 'CD', name: 'DR Congo',                dialCode: '+243', placeholder: '0991 234 567' },
  { code: 'CF', name: 'Central African Republic',dialCode: '+236', placeholder: '70 01 23 45' },
  { code: 'AO', name: 'Angola',                  dialCode: '+244', placeholder: '923 123 456' },
  { code: 'ZM', name: 'Zambia',                  dialCode: '+260', placeholder: '095 5123456' },
  { code: 'ZW', name: 'Zimbabwe',                dialCode: '+263', placeholder: '071 123 4567' },
  { code: 'MW', name: 'Malawi',                  dialCode: '+265', placeholder: '099 1234567' },
  { code: 'MZ', name: 'Mozambique',              dialCode: '+258', placeholder: '82 123 4567' },
  { code: 'BW', name: 'Botswana',                dialCode: '+267', placeholder: '71 123 456' },
  { code: 'NA', name: 'Namibia',                 dialCode: '+264', placeholder: '081 123 4567' },
  { code: 'LS', name: 'Lesotho',                 dialCode: '+266', placeholder: '5012 3456' },
  { code: 'SZ', name: 'Eswatini',                dialCode: '+268', placeholder: '7612 3456' },
  { code: 'MG', name: 'Madagascar',              dialCode: '+261', placeholder: '032 12 345 67' },
  { code: 'MU', name: 'Mauritius',               dialCode: '+230', placeholder: '5251 2345' },
  { code: 'SC', name: 'Seychelles',              dialCode: '+248', placeholder: '2 510 123' },
  { code: 'KM', name: 'Comoros',                 dialCode: '+269', placeholder: '321 23 45' },
  { code: 'RW', name: 'Rwanda',                  dialCode: '+250', placeholder: '0720 123 456' },
  { code: 'BI', name: 'Burundi',                 dialCode: '+257', placeholder: '79 56 12 34' },
  { code: 'SO', name: 'Somalia',                 dialCode: '+252', placeholder: '07 123456' },
  { code: 'ER', name: 'Eritrea',                 dialCode: '+291', placeholder: '07 123456' },
  { code: 'DJ', name: 'Djibouti',                dialCode: '+253', placeholder: '77 83 10 01' },
  { code: 'CV', name: 'Cape Verde',              dialCode: '+238', placeholder: '991 12 34' },
  { code: 'ST', name: 'São Tomé and Príncipe',   dialCode: '+239', placeholder: '981 2345' },
]

/**
 * Common informal aliases / abbreviations that users type but don't match ISO code or name.
 * Maps alias → ISO alpha-2. Only covers genuinely common cases.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB', britain: 'GB', england: 'GB',
  uae: 'AE', emirates: 'AE',
  usa: 'US', america: 'US',
  russia: 'RU',
  korea: 'KR', 'south korea': 'KR',
  china: 'CN',
  taiwan: 'TW',
  holland: 'NL', netherlands: 'NL',
  eire: 'IE', ireland: 'IE',
  persia: 'IR',
}

/** Memoized alphabetical list (no pinning). Used by getPinnedCountries + getRestCountries. */
let _alphaCache: Country[] | null = null
function getAlphaCountries(): Country[] {
  if (_alphaCache) return _alphaCache
  _alphaCache = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name))
  return _alphaCache
}

/** Memoized sorted list: pinned countries first, then alphabetical. */
let _sortedCache: Country[] | null = null
export function getSortedCountries(): Country[] {
  if (_sortedCache) return _sortedCache
  const pinned = PINNED_COUNTRY_CODES
    .map((c) => COUNTRIES.find((x) => x.code === c))
    .filter(Boolean) as Country[]
  const pinnedSet = new Set(PINNED_COUNTRY_CODES)
  const rest = COUNTRIES
    .filter((c) => !pinnedSet.has(c.code))
    .sort((a, b) => a.name.localeCompare(b.name))
  _sortedCache = [...pinned, ...rest]
  return _sortedCache
}

/** Pinned country objects in display order. Memoized. */
let _pinnedCache: Country[] | null = null
export function getPinnedCountries(): Country[] {
  if (_pinnedCache) return _pinnedCache
  _pinnedCache = PINNED_COUNTRY_CODES
    .map((c) => COUNTRIES.find((x) => x.code === c))
    .filter(Boolean) as Country[]
  return _pinnedCache
}

/** All countries except pinned ones, sorted alphabetically. Memoized. */
let _restCache: Country[] | null = null
export function getRestCountries(): Country[] {
  if (_restCache) return _restCache
  const pinnedSet = new Set(PINNED_COUNTRY_CODES)
  _restCache = getAlphaCountries().filter((c) => !pinnedSet.has(c.code))
  return _restCache
}

/** Guess the user's country from browser locale. Returns null if uncertain. */
export function guessCountryFromLocale(): Country | null {
  try {
    const locale = typeof navigator !== 'undefined' ? navigator.language : ''
    // e.g. 'en-US' → 'US', 'fa-IR' → 'IR', 'ar-AE' → 'AE'
    const regionTag = locale.split('-')[1]?.toUpperCase()
    if (!regionTag) return null
    return COUNTRIES.find((c) => c.code === regionTag) ?? null
  } catch {
    return null
  }
}

/**
 * Lightweight timezone→country mapping for the most common zones.
 * Uses Intl.DateTimeFormat().resolvedOptions().timeZone.
 */
export const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'America/Montreal': 'CA', 'America/Sao_Paulo': 'BR', 'America/Buenos_Aires': 'AR',
  'America/Bogota': 'CO', 'America/Mexico_City': 'MX', 'America/Lima': 'PE',
  'America/Santiago': 'CL', 'America/Caracas': 'VE',
  'Europe/London': 'GB', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR',
  'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR', 'Europe/Kiev': 'UA', 'Europe/Moscow': 'RU',
  'Asia/Tehran': 'IR', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
  'Asia/Baghdad': 'IQ', 'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN',
  'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Asia/Tashkent': 'UZ', 'Asia/Almaty': 'KZ', 'Asia/Baku': 'AZ',
  'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Kabul': 'AF',
  'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Singapore': 'SG', 'Asia/Manila': 'PH', 'Asia/Hong_Kong': 'HK',
  'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
  'Asia/Taipei': 'TW', 'Asia/Vladivostok': 'RU',
  'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA', 'Africa/Casablanca': 'MA', 'Africa/Accra': 'GH',
  'Africa/Addis_Ababa': 'ET', 'Africa/Dar_es_Salaam': 'TZ',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU',
  'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ',
}

/** Guess country from browser timezone. Returns null if not mappable. */
export function guessCountryFromTimezone(): Country | null {
  try {
    const tz = typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : ''
    if (!tz) return null
    const code = TIMEZONE_COUNTRY_MAP[tz]
    if (!code) return null
    return COUNTRIES.find((c) => c.code === code) ?? null
  } catch {
    return null
  }
}

/** Load recent countries from localStorage. Excludes pinned countries. */
export function loadRecentCountries(): Country[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(RECENT_COUNTRIES_KEY)
    if (!raw) return []
    const codes: string[] = JSON.parse(raw)
    const pinnedSet = new Set(PINNED_COUNTRY_CODES)
    return codes
      .map((c) => COUNTRIES.find((x) => x.code === c))
      .filter((c): c is Country => !!c && !pinnedSet.has(c.code))
  } catch {
    return []
  }
}

/** Persist a selected country to the recent list (max MAX_RECENT, no duplicates). */
export function saveRecentCountry(code: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const existing = loadRecentCountries().map((c) => c.code)
    const updated = [code, ...existing.filter((c) => c !== code)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_COUNTRIES_KEY, JSON.stringify(updated))
  } catch {
    // localStorage may be blocked in private-browsing mode — ignore
  }
}

/** Persist the last explicitly selected country. Used for detection priority. */
export function saveLastSelected(code: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LAST_SELECTED_KEY, code)
  } catch {}
}

/** Load the last explicitly selected country. */
export function loadLastSelected(): Country | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const code = localStorage.getItem(LAST_SELECTED_KEY)
    if (!code) return null
    return COUNTRIES.find((c) => c.code === code) ?? null
  } catch {
    return null
  }
}

/** Strip non-digit characters from a string. */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * Maximum national (local) digits inferred from the example placeholder.
 * Falls back to 15 (E.164 national portion limit) when placeholder has no digits.
 */
export function getMaxNationalDigits(country: Country): number {
  const fromPlaceholder = digitsOnly(country.placeholder).length
  return fromPlaceholder > 0 ? fromPlaceholder : 15
}

/** Normalize a string for accent-insensitive, case-insensitive comparison. */
export function normalizeQuery(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Score a country against a normalized query string.
 * Returns 0 if no match. Higher = better match.
 * Used for ranking search results.
 */
export function scoreCountry(country: Country, q: string): number {
  if (!q) return 0
  const name = normalizeQuery(country.name)
  const code = country.code.toLowerCase()
  const dial = country.dialCode.replace('+', '')
  const qDigits = q.replace(/^\+/, '')

  // Alias match (e.g. "uk" → GB, "uae" → AE)
  const aliasCode = COUNTRY_ALIASES[q]
  if (aliasCode && aliasCode === country.code) return 90

  // Exact matches
  if (name === q || code === q || dial === qDigits) return 100

  // Starts-with matches
  if (name.startsWith(q) || code.startsWith(q) || dial.startsWith(qDigits)) return 80

  // Contains matches
  if (name.includes(q) || code.includes(q)) return 60
  if (dial.includes(qDigits) && qDigits.length >= 2) return 55

  // Word-boundary match (e.g. "united" matches "United Arab Emirates")
  const words = name.split(/\s+/)
  if (words.some((w) => w.startsWith(q))) return 50

  // Subsequence fuzzy match: all chars of q appear in order in name
  let idx = 0
  for (const ch of name) {
    if (idx < q.length && ch === q[idx]) idx++
    if (idx === q.length) return q.length >= 3 ? 20 : 0 // only for queries ≥3 chars
  }

  return 0
}

/** Search and rank countries by query. Accent-insensitive, fuzzy-tolerant. */
export function searchCountries(query: string): Country[] {
  const q = normalizeQuery(query.trim())
  if (!q) return getSortedCountries()

  const scored = COUNTRIES
    .map((c) => ({ c, score: scoreCountry(c, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))

  return scored.map((x) => x.c)
}
