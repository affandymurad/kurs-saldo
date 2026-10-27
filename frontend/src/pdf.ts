import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { currencySymbol, CURRENCY_TO_COUNTRY } from './currency';
import type { KursBIItem, KursPajakItem } from './types';

// PDF vektor tersusun (teks asli, tabel, tautan) dengan jsPDF + autoTable, bergaya Wikiabstrak:
// pita judul, kartu ringkas, judul bagian beraksen, tabel grid, header berjalan, dan footer berhalaman.

type RGB = readonly [number, number, number];
const C = {
  brand: [79, 70, 229] as RGB,     // indigo-600
  ink: [30, 41, 59] as RGB,        // slate-800
  muted: [100, 116, 139] as RGB,   // slate-500
  line: [226, 232, 240] as RGB,    // slate-200
  soft: [238, 242, 255] as RGB,    // indigo-50
  alt: [248, 250, 252] as RGB,     // slate-50
  white: [255, 255, 255] as RGB,
  up: [5, 150, 105] as RGB,        // emerald-600
  down: [225, 29, 72] as RGB,      // rose-600
  zero: [148, 163, 184] as RGB,    // slate-400
};
const APP_URL = 'kurs-saldo.netlify.app';
const PT_TO_MM = 25.4 / 72;

// ─── Font Roboto (vektor, teks bisa dipilih); bila gagal dimuat dipakai helvetica ───
const bufToBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin);
};
let fontsPromise: Promise<{ normal: string; bold: string }> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all(['Roboto-Regular.ttf', 'Roboto-Bold.ttf'].map(async (f) => {
      const res = await fetch(`/pdf-fonts/${f}`);
      if (!res.ok) throw new Error(`Font ${f}: ${res.status}`);
      return bufToBase64(await res.arrayBuffer());
    })).then(([normal, bold]) => ({ normal, bold })).catch((e) => {
      fontsPromise = null;
      throw e;
    });
  }
  return fontsPromise;
}

// ─── Rasterisasi teks (Kode/simbol) via canvas — biar semua skrip (Arab, Thai, Sinhala, simbol mata uang) render benar tanpa perlu embed font khusus di jsPDF ───
function rasterizeText(text: string, opts: { fontPt?: number; color?: string; bold?: boolean } = {}): { dataUrl: string; widthMm: number; heightMm: number } {
  const scale = 4;
  const fontPt = opts.fontPt ?? 9;
  const cssPx = fontPt * (96 / 72);
  const canvasFontPx = cssPx * scale;
  const fontFamily = '"Segoe UI", Arial, "Noto Sans", "Noto Sans Arabic", "Noto Sans Thai", "Noto Sans Sinhala", sans-serif';
  const font = `${opts.bold ? '700' : '400'} ${canvasFontPx}px ${fontFamily}`;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const width = Math.ceil(measure.measureText(text).width) + Math.ceil(canvasFontPx * 0.3);
  const height = Math.ceil(canvasFontPx * 1.5);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.direction = 'ltr';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = opts.color ?? '#1e293b';
  ctx.fillText(text, canvasFontPx * 0.15, height / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: (width / scale) * (72 / 96) * PT_TO_MM,
    heightMm: (height / scale) * (72 / 96) * PT_TO_MM,
  };
}

// ─── Rasterisasi bendera (SVG dari flag-icons) via canvas ───
// URL SVG diambil langsung dari paket flag-icons (tidak bergantung pada CSS halaman yang mungkin belum termuat)
const FLAG_URLS = import.meta.glob('../node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const flagUrlFor = (cc: string) => FLAG_URLS[`../node_modules/flag-icons/flags/4x3/${cc}.svg`];

const flagCache = new Map<string, string>();
async function loadFlag(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`flag ${res.status}`);
  let svg = await res.text();
  // SVG tanpa width/height tidak bisa digambar ke canvas di sebagian browser (Firefox/Safari)
  svg = svg.replace(/<svg\b([^>]*)>/i, (m, attrs: string) =>
    /\swidth=/.test(attrs) ? m : `<svg${attrs} width="640" height="480">`);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('flag decode failed'));
    i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 96;
  canvas.getContext('2d')!.drawImage(img, 0, 0, 128, 96);
  return canvas.toDataURL('image/png');
}

async function getFlagDataUrl(countryCode: string): Promise<string | null> {
  if (!countryCode) return null;
  const cached = flagCache.get(countryCode);
  if (cached) return cached;
  const url = flagUrlFor(countryCode);
  if (!url) return null;
  // gagal tidak di-cache supaya unduhan berikutnya mencoba lagi
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const dataUrl = await loadFlag(url);
      flagCache.set(countryCode, dataUrl);
      return dataUrl;
    } catch {
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  return null;
}

let logoCache: string | null | undefined;
async function getLogoDataUrl(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('logo load failed'));
      img.src = '/media/ic_kurs_saldo.png';
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

let qrCache: string | null | undefined;
async function getQrDataUrl(): Promise<string | null> {
  if (qrCache !== undefined) return qrCache;
  try {
    qrCache = await QRCode.toDataURL(`https://${APP_URL}`, {
      margin: 0, width: 240, color: { dark: '#312e81', light: '#ffffff' },
    });
  } catch {
    qrCache = null;
  }
  return qrCache;
}

function formatDicetak(date: Date): string {
  const tgl = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const jam = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${tgl}, ${jam}`;
}

function filenameTimestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

interface Column {
  header: string;
  width: number; // mm
  align: 'left' | 'center' | 'right';
}

interface RowSpec {
  no: number;
  countryCode: string;
  mataUangText: string;
  kode: string;
  extra: { text: string; color?: RGB; bold?: boolean }[];
}

interface ReportSpec {
  title: string;
  tanggal: string;
  sourceName: string;
  sourceUrl: string;
  filenamePrefix: string;
  columns: Column[]; // kolom setelah No, Mata Uang, dan Kode
  rows: RowSpec[];
}

async function generateReportPdf(spec: ReportSpec) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date();

  let fontName = 'helvetica';
  try {
    const f = await loadFonts();
    doc.addFileToVFS('Roboto-Regular.ttf', f.normal);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFileToVFS('Roboto-Bold.ttf', f.bold);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    fontName = 'Roboto';
  } catch (e) {
    console.warn('Font PDF gagal dimuat, memakai font bawaan:', e);
  }

  const [logoDataUrl, qrDataUrl] = await Promise.all([getLogoDataUrl(), getQrDataUrl()]);
  const flagUrls = await Promise.all(spec.rows.map(r => getFlagDataUrl(r.countryCode)));
  const kodeImgs = spec.rows.map(r => rasterizeText(r.kode, { fontPt: 8.5, color: '#475569' }));

  const M = 14;
  const contentW = pageW - M * 2;
  const TOP_NEXT = 20;
  const BOTTOM = pageH - 18;
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setFont = (style: 'normal' | 'bold', size: number) => {
    doc.setFont(fontName, style);
    doc.setFontSize(size);
  };

  // ── pita judul ──
  fill(C.brand);
  doc.rect(0, 0, pageW, 28, 'F');
  let titleX = M;
  if (logoDataUrl) {
    fill(C.white);
    doc.roundedRect(M, 6, 16, 16, 3, 3, 'F');
    doc.addImage(logoDataUrl, 'PNG', M + 2.5, 8.5, 11, 11);
    titleX = M + 21;
  }
  color(C.white);
  setFont('bold', 18);
  doc.text(spec.title, titleX, 13.5);
  setFont('normal', 9.5);
  doc.text(`Kurs Saldo  |  ${APP_URL}`, titleX, 21);
  if (qrDataUrl) {
    const q = 18;
    fill(C.white);
    doc.roundedRect(pageW - M - q - 2, 5, q + 4, q + 4, 2, 2, 'F');
    doc.addImage(qrDataUrl, 'PNG', pageW - M - q, 7, q, q);
  }

  // ── kartu ringkas ──
  const tiles: [string, string][] = [
    [spec.tanggal || '-', 'Data per'],
    [String(spec.rows.length), 'Jumlah mata uang'],
    [spec.sourceName, 'Sumber data'],
  ];
  const gap = 4;
  const weights = [2, 1, 1.2]; // kartu tanggal paling lebar (rentang tanggal Kurs Pajak panjang)
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let y = 36;
  let x = M;
  tiles.forEach(([value, label], i) => {
    const tileW = (contentW - gap * (tiles.length - 1)) * weights[i] / weightSum;
    fill(C.soft);
    doc.roundedRect(x, y, tileW, 19, 3, 3, 'F');
    // perkecil font sampai teks muat satu baris
    let size = 13;
    setFont('bold', size);
    while (size > 8 && doc.getTextWidth(value) > tileW - 8) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    color(C.brand);
    doc.text(value, x + 4, y + 8.5);
    setFont('normal', 8);
    color(C.muted);
    doc.text(label, x + 4, y + 14.5);
    x += tileW + gap;
  });
  y += 19 + 8;

  // ── judul bagian ──
  fill(C.brand);
  doc.roundedRect(M, y - 4.2, 1.6, 6, 0.8, 0.8, 'F');
  setFont('bold', 12.5);
  color(C.ink);
  doc.text('Daftar Kurs', M + 4.5, y);
  y += 4;

  // ── tabel ──
  const NO_W = 10;
  const MATA_UANG_W = 50;
  const KODE_W = 26;
  const headers = ['No', 'Mata Uang', 'Kode', ...spec.columns.map(c => c.header)];
  const body = spec.rows.map(r => [String(r.no), r.mataUangText, '', ...r.extra.map(e => e.text)]);

  autoTable(doc, {
    startY: y,
    margin: { top: TOP_NEXT, left: M, right: M, bottom: 18 },
    head: [headers],
    body,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: fontName,
      fontSize: 8.8,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.2, right: 2.2 },
      valign: 'middle',
      overflow: 'linebreak',
      textColor: [...C.ink],
      lineColor: [...C.line],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [...C.ink],
      textColor: [...C.white],
      fontStyle: 'bold',
      lineColor: [...C.ink],
    },
    alternateRowStyles: { fillColor: [...C.alt] },
    columnStyles: {
      0: { cellWidth: NO_W, halign: 'center', textColor: [...C.zero] },
      1: { cellWidth: MATA_UANG_W, halign: 'left', fontStyle: 'bold', cellPadding: { top: 2.6, bottom: 2.6, left: 10, right: 2.2 } },
      2: { cellWidth: KODE_W, halign: 'center' },
      ...Object.fromEntries(spec.columns.map((c, i) => [3 + i, { cellWidth: c.width, halign: c.align }])),
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 1) data.cell.styles.halign = 'left';
      if (data.section === 'head' && data.column.index >= 3) data.cell.styles.halign = spec.columns[data.column.index - 3].align;
      if (data.section === 'body' && data.column.index >= 3) {
        const extra = spec.rows[data.row.index].extra[data.column.index - 3];
        if (extra?.color) data.cell.styles.textColor = [...extra.color];
        if (extra?.bold) data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      if (data.column.index === 1) {
        const flagUrl = flagUrls[data.row.index];
        if (flagUrl) {
          const w = 5.6, h = 4.2;
          doc.addImage(flagUrl, 'PNG', data.cell.x + 2.6, data.cell.y + data.cell.height / 2 - h / 2, w, h);
        }
      }
      if (data.column.index === 2) {
        const img = kodeImgs[data.row.index];
        const x = data.cell.x + data.cell.width / 2 - img.widthMm / 2;
        const yy = data.cell.y + data.cell.height / 2 - img.heightMm / 2;
        doc.addImage(img.dataUrl, 'PNG', x, yy, img.widthMm, img.heightMm);
      }
    },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 9;

  // ── penutup ──
  if (y + 24 > BOTTOM) { doc.addPage(); y = TOP_NEXT; }
  stroke(C.line);
  doc.setLineWidth(0.3);
  doc.line(M, y, pageW - M, y);
  y += 5;
  setFont('normal', 8.5);
  color(C.muted);
  doc.text(`Dicetak: ${formatDicetak(now)}`, M, y);
  y += 4.6;
  doc.text('Sumber:', M, y);
  color([47, 82, 112]);
  doc.text(spec.sourceUrl, M + 12, y);
  doc.link(M + 12, y - 3.2, doc.getTextWidth(spec.sourceUrl), 4.2, { url: spec.sourceUrl });
  y += 4.6;
  color(C.muted);
  doc.text('Data bersifat informatif; untuk keperluan resmi rujuk langsung ke situs sumber.', M, y);

  // ── header berjalan dan footer ──
  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    if (pg > 1) {
      setFont('normal', 8);
      color(C.muted);
      doc.text(`Kurs Saldo  |  ${spec.title}${spec.tanggal ? `  |  ${spec.tanggal}` : ''}`, M, 11);
      stroke(C.line);
      doc.setLineWidth(0.3);
      doc.line(M, 13.5, pageW - M, 13.5);
    }
    stroke(C.line);
    doc.setLineWidth(0.3);
    doc.line(M, pageH - 13, pageW - M, pageH - 13);
    setFont('normal', 8);
    color(C.muted);
    doc.text(`Kurs Saldo  -  dibuat otomatis di ${APP_URL}`, M, pageH - 8);
    doc.text(`Halaman ${pg} / ${total}`, pageW - M, pageH - 8, { align: 'right' });
  }

  doc.save(`${spec.filenamePrefix}_${filenameTimestamp(now)}.pdf`);
}

function perubahanColor(value: string): RGB {
  if (value.startsWith('-')) return C.down;
  if (value === '0,00' || value === '0') return C.zero;
  return C.up;
}

export async function generateKursBiPdf(data: KursBIItem[], tanggal: string) {
  const rows: RowSpec[] = data.map((row, idx) => ({
    no: idx + 1,
    countryCode: CURRENCY_TO_COUNTRY[row.mataUang?.toUpperCase()] || '',
    mataUangText: row.mataUang,
    kode: `${currencySymbol(row.mataUang)}‎ ${row.nilai}`,
    extra: [
      { text: row.kursBeli, color: C.brand },
      { text: row.kursTengah, color: C.brand, bold: true },
      { text: row.kursJual, color: C.brand },
    ],
  }));

  await generateReportPdf({
    title: 'Laporan Kurs Bank Indonesia',
    tanggal,
    sourceName: 'Bank Indonesia',
    sourceUrl: 'https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx',
    filenamePrefix: 'kurs_bi',
    columns: [
      { header: 'Beli', width: 32, align: 'right' },
      { header: 'Tengah', width: 32, align: 'right' },
      { header: 'Jual', width: 32, align: 'right' },
    ],
    rows,
  });
}

export async function generateKursPajakPdf(data: KursPajakItem[], tanggal: string) {
  const rows: RowSpec[] = data.map((row, idx) => ({
    no: idx + 1,
    countryCode: CURRENCY_TO_COUNTRY[row.mataUang?.toUpperCase()] || '',
    mataUangText: row.mataUangName,
    kode: `${currencySymbol(row.mataUang)}‎ ${row.nilai}`,
    extra: [
      { text: row.kurs, color: C.brand, bold: true },
      { text: (row.perubahan.startsWith('-') || row.perubahan === '0,00' || row.perubahan === '0') ? row.perubahan : `+${row.perubahan}`, color: perubahanColor(row.perubahan) },
    ],
  }));

  await generateReportPdf({
    title: 'Laporan Kurs Pajak',
    tanggal,
    sourceName: 'Kemenkeu (DJP)',
    sourceUrl: 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak',
    filenamePrefix: 'kurs_pajak',
    columns: [
      { header: 'Kurs Pajak', width: 48, align: 'right' },
      { header: 'Perubahan', width: 48, align: 'right' },
    ],
    rows,
  });
}
