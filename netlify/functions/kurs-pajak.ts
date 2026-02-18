import type { Handler } from '@netlify/functions';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import {
  authenticate,
  unauthorizedResponse,
  successResponse,
  errorResponse,
  corsHeaders,
  parseIndonesianNumber,
  formatIndonesian,
  convertTanggal
} from './shared/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface KursPajakItem {
  mataUang: string;     // "USD"
  mataUangName: string; // "Dolar Amerika Serikat"
  nilai: string;        // "1" atau "100" (JPY)
  kurs: string;         // "16.211,00"
  perubahan: string;    // "0,00"
}

interface KursPajakResponse {
  tanggal: string;              // "18 Februari 2026 - 24 Februari 2026"
  tanggalMulai: string;         // "18 Februari 2026"
  tanggalSelesai: string;       // "24 Februari 2026"
  tanggalFormatMulai: string;   // "18/02/2026"
  tanggalFormatSelesai: string; // "24/02/2026"
  data: KursPajakItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseRangeTanggalPajak(rangeStr: string) {
  const parts = rangeStr.split(' - ').map(s => s.trim());
  if (parts.length !== 2) {
    return { mulai: rangeStr, selesai: rangeStr, formatMulai: rangeStr, formatSelesai: rangeStr };
  }
  return {
    mulai: parts[0],
    selesai: parts[1],
    formatMulai: convertTanggal(parts[0]),
    formatSelesai: convertTanggal(parts[1])
  };
}

// ─── Scraper ───────────────────────────────────────────────────────────────

async function fetchKursPajak(): Promise<KursPajakResponse> {
  const PAJAK_URL = 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak';

  const response = await axios.get(PAJAK_URL, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  const $ = cheerio.load(response.data);

  // ── Ambil tanggal berlaku ──
  let tanggalRaw = '';

  $('.text-muted').each((_, el) => {
    const text = $(el).text().replace(/\u00A0/g, ' ').trim();
    if (text.includes('Tanggal Berlaku:')) {
      tanggalRaw = text.replace('Tanggal Berlaku:', '').trim();
    }
  });

  if (!tanggalRaw) {
    throw new Error('Tanggal berlaku tidak ditemukan');
  }

  const { mulai, selesai, formatMulai, formatSelesai } = parseRangeTanggalPajak(tanggalRaw);

  // ── Ambil tabel kurs ──
  const table = $('.table').first();
  if (!table.length) {
    throw new Error('Tabel kurs pajak tidak ditemukan. Struktur halaman mungkin berubah.');
  }

  const items: KursPajakItem[] = [];
  const rows = table.find('tr');

  console.log('Total rows:', rows.length);

  rows.each((rowIndex, row) => {
    if (rowIndex === 0) return; // skip header

    const cols = $(row).find('td');
    if (cols.length < 3) return;

    let fullName = '';
    let kursRaw = '';
    let perubahanRaw = '';

    if (cols.length >= 4) {
      fullName     = $(cols[1]).text().replace(/\u00A0/g, ' ').trim();
      kursRaw      = $(cols[2]).text().trim();
      perubahanRaw = $(cols[3]).text().trim();
    } else {
      fullName     = $(cols[0]).text().replace(/\u00A0/g, ' ').trim();
      kursRaw      = $(cols[1]).text().trim();
      perubahanRaw = $(cols[2]).text().trim();
    }

    if (!fullName || !kursRaw) return;

    // ── Extract kode mata uang ──
    let mataUang = '';
    const matchBracket = fullName.match(/\((\w{3})\)/);
    if (matchBracket) {
      mataUang = matchBracket[1];
    } else {
      const matchPlain = fullName.match(/\b([A-Z]{3})$/);
      if (matchPlain) mataUang = matchPlain[1];
    }
    if (!mataUang) return;

    // ── Bersihkan nama mata uang ──
    const mataUangName = fullName
      .replace(/\(\w{3}\)/, '')
      .replace(/\b[A-Z]{3}$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const nilai      = mataUang === 'JPY' ? '100' : '1';
    const kurs       = parseIndonesianNumber(kursRaw);
    const perubahan  = perubahanRaw ? parseIndonesianNumber(perubahanRaw) : 0;

    items.push({
      mataUang,
      mataUangName,
      nilai,
      kurs: formatIndonesian(kurs),
      perubahan: formatIndonesian(perubahan)
    });
  });

  console.log('Total items parsed:', items.length);

  if (items.length === 0) {
    throw new Error('Tidak ada data kurs yang berhasil diparse. Struktur tabel mungkin berubah.');
  }

  return {
    tanggal: tanggalRaw,
    tanggalMulai: mulai,
    tanggalSelesai: selesai,
    tanggalFormatMulai: formatMulai,
    tanggalFormatSelesai: formatSelesai,
    data: items
  };
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
    const result = await fetchKursPajak();
    return successResponse({ success: true, ...result });
  } catch (error: any) {
    console.error('Error fetching kurs pajak:', error.message);
    return errorResponse(500, error.message || 'Gagal mengambil data Kurs Pajak');
  }
};