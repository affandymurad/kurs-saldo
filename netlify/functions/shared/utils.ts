import https from 'https';

// ─── Auth ──────────────────────────────────────────────────────────────────

export const API_KEY = process.env.API_KEY || 'kurs-saldo-secret-key-2026';

export function authenticate(event: { headers: Record<string, string | undefined> }): boolean {
  const apiKey = event.headers['x-api-key'];
  return !!(apiKey && apiKey === API_KEY);
}

export function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: corsHeaders(),
    body: JSON.stringify({ success: false, error: 'Unauthorized: Invalid API Key' })
  };
}

export function errorResponse(statusCode: number, message: string) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ success: false, error: message })
  };
}

export function successResponse(data: object, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(data)
  };
}

// ─── CORS ──────────────────────────────────────────────────────────────────

export function corsHeaders(): Record<string, string> {
  const origin = process.env.FRONTEND_URL || '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

// ─── HTML Entity Decoder ───────────────────────────────────────────────────

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ─── Number & Date Helpers ─────────────────────────────────────────────────

export function parseIndonesianNumber(raw: string): number {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

export function formatIndonesian(num: number): string {
  return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const BULAN_ID: Record<string, string> = {
  'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04',
  'Mei': '05', 'Juni': '06', 'Juli': '07', 'Agustus': '08',
  'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12'
};

export function convertTanggal(tanggalStr: string): string {
  const parts = tanggalStr.trim().split(' ');
  if (parts.length !== 3) return tanggalStr;
  const [dd, bulan, yyyy] = parts;
  const mm = BULAN_ID[bulan] || '00';
  return `${dd.padStart(2, '0')}/${mm}/${yyyy}`;
}

// ─── HTTPS Agent ───────────────────────────────────────────────────────────

export const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: true
});

export const httpsAgentInsecure = new https.Agent({
  rejectUnauthorized: false
});

// ─── RSS Sources & Types ───────────────────────────────────────────────────

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  image?: string;
  source: string;
  logo: string;
  /**
   * Path asset lokal yang di-resolve oleh frontend.
   * Nilai ini adalah penanda nama sumber; resolusi ke file aktual
   * dilakukan di frontend via SOURCE_LOGOS map di App.tsx.
   * Tidak lagi menyimpan data base64 di sini.
   */
  logoUrl: string;
  language: string;
}

export const RSS_SOURCES = [
  {
    name: 'Detik',
    url: 'https://finance.detik.com/rss',
    logo: '🔴',
    // logoUrl dirujuk sebagai identifier; frontend memetakan ke assets/detikcom.png
    logoUrl: 'detikcom',
    language: 'Indonesia'
  },
  {
    name: 'Tempo',
    url: 'https://rss.tempo.co/bisnis',
    logo: '🟢',
    // frontend memetakan ke assets/tempo.png
    logoUrl: 'tempo',
    language: 'Indonesia'
  },
  {
    name: 'CNBC Indonesia',
    url: 'https://www.cnbcindonesia.com/market/rss/',
    logo: '🔵',
    // frontend memetakan ke assets/cnbc_indonesia.svg
    logoUrl: 'cnbc_indonesia',
    language: 'Indonesia'
  }
];