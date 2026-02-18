import type { Handler } from '@netlify/functions';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  authenticate,
  unauthorizedResponse,
  successResponse,
  errorResponse,
  corsHeaders,
  parseIndonesianNumber,
  formatIndonesian,
  convertTanggal,
  httpsAgent
} from './shared/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface KursBIItem {
  mataUang: string;
  nilai: string;
  kursJual: string;
  kursBeli: string;
  kursTengah: string;
}

interface KursBIResponse {
  tanggal: string;       // "13 Februari 2026"
  tanggalFormat: string; // "13/02/2026"
  data: KursBIItem[];
}

// ─── Scraper ───────────────────────────────────────────────────────────────

async function fetchKursBI(): Promise<KursBIResponse> {
  const BI_URL = 'https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx';
  const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

  const response = await axios.get(BI_URL, {
    timeout: 20000,
    httpsAgent,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      'Connection': 'keep-alive'
    }
  });

  const $ = cheerio.load(response.data);

  // ── Ambil tanggal ──
  let tanggalRaw = '';
  const BULAN_NAMES = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  $('div.text-left span').each((_, el) => {
    const text = $(el).text().trim();
    if (BULAN_NAMES.some(b => text.includes(b))) {
      const match = text.match(/(\d{1,2}\s\w+\s\d{4})/);
      if (match) tanggalRaw = match[1];
    }
  });

  // Fallback
  if (!tanggalRaw) {
    const bodyText = $('body').text();
    const match = bodyText.match(
      /(\d{1,2}\s(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s\d{4})/
    );
    if (match) tanggalRaw = match[1];
  }

  const tanggalFormat = convertTanggal(tanggalRaw);

  // ── Ambil tabel ──
  const TABLE_ID =
    '#ctl00_PlaceHolderMain_g_6c89d4ad_107f_437d_bd54_8fda17b556bf_ctl00_GridView1';
  const table = $(TABLE_ID);

  if (!table.length) {
    throw new Error('Tabel kurs BI tidak ditemukan. Struktur halaman mungkin berubah.');
  }

  const items: KursBIItem[] = [];

  table.find('tr').each((rowIndex, row) => {
    if (rowIndex === 0) return; // skip header

    const cols = $(row).find('td');
    if (cols.length < 4) return;

    const mataUang = $(cols[0]).text().trim();
    const nilai    = $(cols[1]).text().trim();
    const kursJual = $(cols[2]).text().trim();
    const kursBeli = $(cols[3]).text().trim();

    if (!mataUang) return;

    const jualNum    = parseIndonesianNumber(kursJual);
    const beliNum    = parseIndonesianNumber(kursBeli);
    const kursTengah = formatIndonesian((jualNum + beliNum) / 2);

    items.push({ mataUang, nilai, kursJual, kursBeli, kursTengah });
  });

  return { tanggal: tanggalRaw, tanggalFormat, data: items };
}

// ─── Handler ───────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!authenticate(event)) return unauthorizedResponse();

  try {
    const result = await fetchKursBI();
    return successResponse({ success: true, ...result });
  } catch (error: any) {
    console.error('Error fetching kurs BI:', error.message);
    return errorResponse(500, error.message || 'Gagal mengambil data Kurs BI');
  }
};