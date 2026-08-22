import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { currencySymbol, CURRENCY_TO_COUNTRY } from './currency';
import type { KursBIItem, KursPajakItem } from './types';

const BRAND = { r: 79, g: 70, b: 229 };      // indigo-600
const HEADER_DARK = { r: 30, g: 41, b: 59 }; // slate-800
const ROW_ALT = { r: 248, g: 250, b: 252 };  // slate-50
const MUTED = { r: 100, g: 116, b: 139 };    // slate-500
const BORDER = { r: 226, g: 232, b: 240 };   // slate-200
const APP_URL = 'kurs-saldo.netlify.app';

// ─── Rasterisasi teks (Kode/simbol) via canvas — biar semua skrip (Arab, Thai, Sinhala, simbol mata uang) render benar tanpa perlu embed font khusus di jsPDF ───
function rasterizeText(text: string, opts: { fontPt?: number; color?: string; bold?: boolean } = {}): { dataUrl: string; widthPt: number; heightPt: number } {
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
    widthPt: (width / scale) * (72 / 96),
    heightPt: (height / scale) * (72 / 96),
  };
}

// ─── Rasterisasi bendera (SVG dari flag-icons) via canvas ───
const flagCache = new Map<string, string | null>();
async function getFlagDataUrl(countryCode: string): Promise<string | null> {
  if (flagCache.has(countryCode)) return flagCache.get(countryCode)!;
  const span = document.createElement('span');
  span.className = `fi fi-${countryCode}`;
  span.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:32px;height:24px;';
  document.body.appendChild(span);
  const bg = getComputedStyle(span).backgroundImage;
  document.body.removeChild(span);
  const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
  if (!match) { flagCache.set(countryCode, null); return null; }
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 64, 48);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('flag load failed'));
      img.src = match[1];
    });
    flagCache.set(countryCode, dataUrl);
    return dataUrl;
  } catch {
    flagCache.set(countryCode, null);
    return null;
  }
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
  width: number;
  align: 'left' | 'center' | 'right';
}

interface RowSpec {
  no: number;
  countryCode: string;
  mataUangText: string;
  kode: string;
  extra: { text: string; color?: { r: number; g: number; b: number } }[];
}

interface ReportSpec {
  title: string;
  dataPerLabel: string;
  sourceUrl: string;
  filenamePrefix: string;
  columns: Column[]; // kolom setelah No & Mata Uang & Kode
  rows: RowSpec[];
}

async function generateReportPdf(spec: ReportSpec) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  const [logoDataUrl, qrDataUrl] = await Promise.all([getLogoDataUrl(), getQrDataUrl()]);
  const flagUrls = await Promise.all(spec.rows.map(r => getFlagDataUrl(r.countryCode)));
  const kodeImgs = spec.rows.map(r => rasterizeText(r.kode, { fontPt: 8.5, color: '#475569' }));

  const NO_W = 26;
  const MATA_UANG_W = 118;
  const KODE_W = 62;
  const headers = ['No', 'Mata Uang', 'Kode', ...spec.columns.map(c => c.header)];
  const body = spec.rows.map(r => [
    String(r.no),
    r.mataUangText,
    '',
    ...r.extra.map(e => e.text),
  ]);

  const meta1 = `${spec.dataPerLabel}  •  Dicetak: ${formatDicetak(now)}  •  ${spec.rows.length} mata uang`;
  const meta2 = `Sumber: ${spec.sourceUrl}`;

  const HEADER_BAND_H = 66;

  function drawHeader() {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, 0, pageWidth, HEADER_BAND_H, 'F');

    if (logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(24, 15, 36, 36, 8, 8, 'F');
      doc.addImage(logoDataUrl, 'PNG', 30, 21, 24, 24);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(spec.title, 72, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Kurs Saldo', 72, 47);

    const qrSize = 44;
    const qrX = pageWidth - 24 - qrSize;
    const qrY = 11;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 6, 6, 'F');
    if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(APP_URL, qrX + qrSize / 2, qrY + qrSize + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(meta1, 24, HEADER_BAND_H + 16);
    doc.text(meta2, 24, HEADER_BAND_H + 28);
  }

  function drawFooter(pageNum: number, pageCount: number) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
    doc.line(24, pageHeight - 30, pageWidth - 24, pageHeight - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text('Dokumen ini dicetak otomatis oleh aplikasi Kurs Saldo.', 24, pageHeight - 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(`Halaman ${pageNum} / ${pageCount}`, pageWidth - 24, pageHeight - 16, { align: 'right' });
  }

  const mataUangColIdx = 1;
  const kodeColIdx = 2;

  autoTable(doc, {
    startY: HEADER_BAND_H + 40,
    margin: { top: HEADER_BAND_H + 40, left: 24, right: 24, bottom: 40 },
    head: [headers],
    body,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      valign: 'middle',
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [HEADER_DARK.r, HEADER_DARK.g, HEADER_DARK.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [ROW_ALT.r, ROW_ALT.g, ROW_ALT.b] },
    columnStyles: {
      0: { cellWidth: NO_W, halign: 'center', textColor: [148, 163, 184] },
      1: { cellWidth: MATA_UANG_W, halign: 'left', cellPadding: { top: 7, bottom: 7, left: 26, right: 6 }, fontStyle: 'bold' },
      2: { cellWidth: KODE_W, halign: 'center' },
      ...Object.fromEntries(spec.columns.map((c, i) => [3 + i, { cellWidth: c.width, halign: c.align }])),
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index >= 3) {
        const extra = spec.rows[data.row.index].extra[data.column.index - 3];
        if (extra?.color) data.cell.styles.textColor = [extra.color.r, extra.color.g, extra.color.b];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      if (data.column.index === mataUangColIdx) {
        const flagUrl = flagUrls[data.row.index];
        if (flagUrl) {
          const h = 12, w = 16;
          doc.addImage(flagUrl, 'PNG', data.cell.x + 6, data.cell.y + data.cell.height / 2 - h / 2, w, h);
        }
      }
      if (data.column.index === kodeColIdx) {
        const img = kodeImgs[data.row.index];
        const x = data.cell.x + data.cell.width / 2 - img.widthPt / 2;
        const y = data.cell.y + data.cell.height / 2 - img.heightPt / 2;
        doc.addImage(img.dataUrl, 'PNG', x, y, img.widthPt, img.heightPt);
      }
    },
    didDrawPage: drawHeader,
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  doc.save(`${spec.filenamePrefix}_${filenameTimestamp(now)}.pdf`);
}

function positiveNegativeColor(value: string): { r: number; g: number; b: number } | undefined {
  if (value.startsWith('-')) return { r: 225, g: 29, b: 72 };   // rose-600
  if (value === '0,00' || value === '0') return { r: 148, g: 163, b: 184 }; // slate-400
  return { r: 5, g: 150, b: 105 }; // emerald-600
}

export async function generateKursBiPdf(data: KursBIItem[], tanggal: string) {
  const rows: RowSpec[] = data.map((row, idx) => ({
    no: idx + 1,
    countryCode: CURRENCY_TO_COUNTRY[row.mataUang?.toUpperCase()] || '',
    mataUangText: row.mataUang,
    kode: `${currencySymbol(row.mataUang)}‎ ${row.nilai}`,
    extra: [
      { text: row.kursBeli, color: { r: BRAND.r, g: BRAND.g, b: BRAND.b } },
      { text: row.kursTengah, color: { r: BRAND.r, g: BRAND.g, b: BRAND.b } },
      { text: row.kursJual, color: { r: BRAND.r, g: BRAND.g, b: BRAND.b } },
    ],
  }));

  await generateReportPdf({
    title: 'Laporan Kurs Bank Indonesia',
    dataPerLabel: `Data per: ${tanggal}`,
    sourceUrl: 'https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx',
    filenamePrefix: 'kurs_bi',
    columns: [
      { header: 'Beli', width: 84, align: 'right' },
      { header: 'Tengah', width: 84, align: 'right' },
      { header: 'Jual', width: 84, align: 'right' },
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
      { text: row.kurs, color: { r: BRAND.r, g: BRAND.g, b: BRAND.b } },
      { text: (row.perubahan.startsWith('-') || row.perubahan === '0,00' || row.perubahan === '0') ? row.perubahan : `+${row.perubahan}`, color: positiveNegativeColor(row.perubahan) },
    ],
  }));

  await generateReportPdf({
    title: 'Laporan Kurs Pajak',
    dataPerLabel: `Data per: ${tanggal}`,
    sourceUrl: 'https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak',
    filenamePrefix: 'kurs_pajak',
    columns: [
      { header: 'Pajak', width: 110, align: 'right' },
      { header: 'Perubahan', width: 110, align: 'right' },
    ],
    rows,
  });
}
