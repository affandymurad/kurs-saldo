// Map kode mata uang (ISO 4217) → kode negara (ISO 3166-1 alpha-2) untuk flag-icons
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp', CHF: 'ch',
  AUD: 'au', NZD: 'nz', CAD: 'ca', SGD: 'sg', HKD: 'hk',
  CNY: 'cn', CNH: 'cn', KRW: 'kr', INR: 'in', THB: 'th',
  MYR: 'my', PHP: 'ph', VND: 'vn', IDR: 'id', BND: 'bn',
  LAK: 'la', MMK: 'mm', KHR: 'kh', PKR: 'pk', BDT: 'bd',
  LKR: 'lk', NPR: 'np', SAR: 'sa', AED: 'ae', KWD: 'kw',
  QAR: 'qa', BHD: 'bh', OMR: 'om', JOD: 'jo', ILS: 'il',
  TRY: 'tr', EGP: 'eg', ZAR: 'za', NGN: 'ng', KES: 'ke',
  RUB: 'ru', UAH: 'ua', PLN: 'pl', CZK: 'cz', HUF: 'hu',
  RON: 'ro', BGN: 'bg', HRK: 'hr', SEK: 'se', NOK: 'no',
  DKK: 'dk', ISK: 'is', MXN: 'mx', BRL: 'br', ARS: 'ar',
  CLP: 'cl', COP: 'co', PEN: 'pe', PGK: 'pg', FJD: 'fj',
  XDR: 'un', SDR: 'un',
};

export function flagClass(code: string): string {
  const cc = CURRENCY_TO_COUNTRY[code?.toUpperCase()];
  return cc ? `fi fi-${cc}` : '';
}

// Simbol mata uang, meniru getCountry() di app Android Kurs Saldo
export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', AUD: '$', BND: '$', CAD: '$', HKD: '$', NZD: '$', SGD: '$', TWD: '$',
  EUR: '€', GBP: '£', ITL: '£', CHF: 'Fr', CNY: '¥', CNH: '¥', JPY: '¥',
  KRW: '₩', KWD: 'د.ك', MYR: 'RM', NOK: 'kr', DKK: 'kr', SEK: 'kr',
  PGK: 'K', MMK: 'K', PHP: '₱', PKR: 'Rs', SAR: '﷼', THB: '฿', IDR: 'Rp',
  INR: '₹', LAK: '₭N', VND: '₫', AED: 'د.إ', LKR: 'රු',
  ATS: 'öS', BEF: 'fr.', DEM: 'DM', FRF: '₣', NLG: 'ƒ',
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOL[code?.toUpperCase()] || '¤';
}

// LRM (U+200E) mencegah digit setelah simbol RTL (mis. د.إ, د.ك) ikut terbalik oleh algoritma bidi Unicode
export function formatNilai(code: string, nilai: string): string {
  return `${currencySymbol(code)}‎ ${nilai}`;
}
