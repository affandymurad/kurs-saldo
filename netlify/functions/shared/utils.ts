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
  logoUrl: string;
  language: string;
}

export const RSS_SOURCES = [
  {
    name: 'Detik',
    url: 'https://finance.detik.com/rss',
    logo: '🔴',
    logoUrl: 'data:image/png;base64,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',
    language: 'Indonesia'
  },
  {
    name: 'Tempo',
    url: 'https://rss.tempo.co/bisnis',
    logo: '🟢',
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAHlBMVEX8/f3p6env7+/j4+Pb29v19fXf39/VAQfiqarvx8jAtUR1AAAAxklEQVQ4jc2QWRKEMAgFHyRh4v0vPAGygKU1v9NEZemiVOAfaBZv/bYSum7QnitA/9zoPmnr8SjgCG3sHPDwOmtWrpY2LK6zewvMjS3Vu26YOXvA5qyMO0zgjbY40qawz5sQyALrS+YOiDV4PuwzZ+GB8fH2B/zs/8DzIlBkClF5FCIPAt2EEoJciC0Uh+xaghfWhM1oaSacupwNWQhkoaiQO5CIC6kFKTPs9EGVU6uQV8gd1Cp1MTKRUCsQG3gc8QTqD34KXwjjDQBUGA9kAAAAAElFTkSuQmCC',
    language: 'Indonesia'
  },
  {
    name: 'CNBC Indonesia',
    url: 'https://www.cnbcindonesia.com/market/rss/',
    logo: '🔵',
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3NCIgaGVpZ2h0PSIzNiIgdmlld0JveD0iLTMgLTMgODAgNDIiIGZpbGw9Im5vbmUiPjxnIGlkPSJkZWVkaXRvcl9iZ0NhcnJpZXIiIHN0cm9rZS13aWR0aD0iMCI+CiAgICA8cmVjdCBpZD0iZGVlX2NfZSIgeD0iLTMiIHk9Ii0zIiB3aWR0aD0iODAiIGhlaWdodD0iNDIiIHJ4PSIwIiBmaWxsPSIjZmZmZmZmIiBzdHJva2V3aWR0aD0iMCIvPgogIDwvZz4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwXzE0ODQyXzI5MTM3KSI+CjxwYXRoIGQ9Ik0zNC43MjY2IDI3LjE1NTNIMzYuNDk4M0w0MC41ODgyIDMyLjUxMDFWMjcuMTU1M0g0Mi40ODQzVjM1Ljg1MDlINDAuODUxMUwzNi42MjI2IDMwLjMyMzFWMzUuODUwOUgzNC43MjY2VjI3LjE1NTNaIiBmaWxsPSIjMDAxRTVBIi8+CjxwYXRoIGQ9Ik00NC43NDIyIDI3LjE1NTNINTEuMzI3MlYyOC44NTY2SDQ2LjY1MDlWMzAuNjIxNUg1MC43NjY0VjMyLjMyMjhINDYuNjUwOVYzNC4xNDk2SDUxLjM5MVYzNS44NTA5SDQ0Ljc0MzhWMjcuMTU1M0g0NC43NDIyWiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNNTIuNjU2MiAzNC41ODQ1TDUzLjc5MDcgMzMuMjMwN0M1NC41NzYyIDMzLjg3NjYgNTUuMzk5OSAzNC4yODYxIDU2LjM5NzMgMzQuMjg2MUM1Ny4xODI4IDM0LjI4NjEgNTcuNjU3NiAzMy45NzUgNTcuNjU3NiAzMy40NjU2VjMzLjQ0MDJDNTcuNjU3NiAzMi45NTYxIDU3LjM1OCAzMi43MDY5IDU1Ljg5ODYgMzIuMzM0QzU0LjEzOTYgMzEuODg2NCA1My4wMDUyIDMxLjQwMjMgNTMuMDA1MiAyOS42NzU2VjI5LjY1MDJDNTMuMDA1MiAyOC4wNzI2IDU0LjI3NjYgMjcuMDI4MyA1Ni4wNjExIDI3LjAyODNDNTcuMzMyNSAyNy4wMjgzIDU4LjQxNzYgMjcuNDI1MSA1OS4zMDM0IDI4LjEzNDVMNTguMzA2IDI5LjU3NTZDNTcuNTMzMyAyOS4wNDA4IDU2Ljc3MTcgMjguNzE4NiA1Ni4wMzU2IDI4LjcxODZDNTUuMjk5NSAyOC43MTg2IDU0LjkxMzkgMjkuMDUzNCA1NC45MTM5IDI5LjQ3NzJWMjkuNTAyNkM1NC45MTM5IDMwLjA3MzkgNTUuMjg4NCAzMC4yNjEyIDU2Ljc5NzIgMzAuNjQ1M0M1OC41Njg5IDMxLjEwNTYgNTkuNTY2MyAzMS43Mzg4IDU5LjU2NjMgMzMuMjU0NVYzMy4yNzk5QzU5LjU2NjMgMzUuMDA2NiA1OC4yNDM5IDM1Ljk3NjMgNTYuMzYwNiAzNS45NzYzQzU1LjAzODIgMzUuOTc2MyA1My43MDQ2IDM1LjUxNjEgNTIuNjU2MiAzNC41ODQ1WiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNNjEuNTU0NyAyNy4xNTUzSDYzLjQ3NDZWMzUuODUwOUg2MS41NTQ3VjI3LjE1NTNaIiBmaWxsPSIjMDAxRTVBIi8+CjxwYXRoIGQ9Ik02OC40ODMyIDI3LjA5MThINzAuMjU0OUw3My45OTYgMzUuODUxSDcxLjk4ODRMNzEuMTkwMiAzMy45MDA0SDY3LjQ5ODZMNjYuNzAwMyAzNS44NTFINjQuNzQyMkw2OC40ODMyIDI3LjA5MThaTTcwLjUwMzUgMzIuMjEwMkw2OS4zNDM2IDI5LjM4OTlMNjguMTgzNyAzMi4yMTAySDcwLjUwMzVaIiBmaWxsPSIjMDAxRTVBIi8+CjxwYXRoIGQ9Ik0wLjkxNDA2MiAyNy4xNTUzSDIuODM1NTZWMzUuODUwOUgwLjkxNDA2MlYyNy4xNTUzWiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNNC43NjU2MiAyNy4xNTUzSDYuNTM3MzVMMTAuNjI3MyAzMi41MTAxVjI3LjE1NTNIMTIuNTIzM1YzNS44NTA5SDEwLjg5MDJMNi42NjE2MyAzMC4zMjMxVjM1Ljg1MDlINC43NjU2MlYyNy4xNTUzWiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNMTQuNjI1IDI3LjE1NTNIMTguMDI5OEMyMC43NzM1IDI3LjE1NTMgMjIuNjY5NSAyOS4wMzEyIDIyLjY2OTUgMzEuNDc4NVYzMS41MDM5QzIyLjY2OTUgMzMuOTUxMiAyMC43NzM1IDM1Ljg1MjUgMTguMDI5OCAzNS44NTI1SDE0LjYyNVYyNy4xNTY5VjI3LjE1NTNaTTE2LjU0NDkgMjguODgyVjM0LjEyNDJIMTguMDI5OEMxOS42MDA4IDM0LjEyNDIgMjAuNjYxOSAzMy4wNjg4IDIwLjY2MTkgMzEuNTI3N1YzMS41MDIzQzIwLjY2MTkgMjkuOTYxMyAxOS42MDI0IDI4Ljg4MDQgMTguMDI5OCAyOC44ODA0SDE2LjU0NDlWMjguODgyWiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNMjMuOTkyMiAzMS41Mjc2VjMxLjUwMjJDMjMuOTkyMiAyOS4wMjk1IDI1Ljk1MDMgMjcuMDA0NCAyOC42NDQ2IDI3LjAwNDRDMzEuMzM4OCAyNy4wMDQ0IDMzLjI3MTUgMjkuMDA0MSAzMy4yNzE1IDMxLjQ3NjhWMzEuNTAyMkMzMy4yNzE1IDMzLjk3NDkgMzEuMzEzMyAzNiAyOC42MTkxIDM2QzI1LjkyNDggMzYgMjMuOTkyMiAzNC4wMDAzIDIzLjk5MjIgMzEuNTI3NlpNMzEuMjYyMyAzMS41Mjc2VjMxLjUwMjJDMzEuMjYyMyAzMC4wMTE5IDMwLjE2NDYgMjguNzY5MiAyOC42MTkxIDI4Ljc2OTJDMjcuMDczNiAyOC43NjkyIDI1Ljk5OTcgMjkuOTg2NSAyNS45OTk3IDMxLjQ3NjhWMzEuNTAyMkMyNS45OTk3IDMyLjk5MjUgMjcuMDk3NSAzNC4yMzUyIDI4LjY0MyAzNC4yMzUyQzMwLjE4ODUgMzQuMjM1MiAzMS4yNjIzIDMzLjAxNzkgMzEuMjYyMyAzMS41Mjc2WiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNMzUuOTU2IDBWMTMuNzYzM0wyMi4xNDA2IDBIMzUuOTU2WiIgZmlsbD0iIzAwNzZGRiIvPgo8cGF0aCBkPSJNNTUuODQ1MyAxMy41MTQyVjEzLjQ1ODZDNTUuODQ1MyA3Ljk0NTA5IDYwLjAxODEgMy40MjgyMiA2NS45OTkzIDMuNDI4MjJDNjkuNjcxOCAzLjQyODIyIDcxLjg2OSA0LjY0NzExIDczLjY3NTggNi40MTk4OUw3MC45NDk3IDkuNTUxMjJDNjkuNDQ3MiA4LjE5NDI2IDY3LjkxNzYgNy4zNjI2MiA2NS45NzA3IDcuMzYyNjJDNjIuNjg4NSA3LjM2MjYyIDYwLjMyNDEgMTAuMDc4MSA2MC4zMjQxIDEzLjQwMzFWMTMuNDU4NkM2MC4zMjQxIDE2Ljc4MzYgNjIuNjMyNyAxOS41NTQ3IDY1Ljk3MDcgMTkuNTU0N0M2OC4xOTY1IDE5LjU1NDcgNjkuNTU4NyAxOC42Njc1IDcxLjA4ODMgMTcuMjgxOUw3My44MTQ0IDIwLjAyNkM3MS44MTE2IDIyLjE1OTEgNjkuNTg1OCAyMy40ODkxIDY1LjgzMDQgMjMuNDg5MUM2MC4xMDEgMjMuNDg5MSA1NS44NDM4IDE5LjA4MzMgNTUuODQzOCAxMy41MTQySDU1Ljg0NTNaIiBmaWxsPSIjMDAxRTVBIi8+CjxwYXRoIGQ9Ik0wLjAwMTU5MzI4IDEzLjUxNDJWMTMuNDU4NkMwLjAwMTU5MzI4IDcuOTQ1MDkgNC4xNzQ0IDMuNDI4MjIgMTAuMTU1NiAzLjQyODIyQzEzLjgyODEgMy40MjgyMiAxNi4wMjUyIDQuNjQ3MTEgMTcuODMyIDYuNDE5ODlMMTUuMTA1OSA5LjU1MTIyQzEzLjYwMzQgOC4xOTQyNiAxMi4wNzM5IDcuMzYyNjIgMTAuMTI2OSA3LjM2MjYyQzYuODQ0NzQgNy4zNjI2MiA0LjQ4MDMxIDEwLjA3ODEgNC40ODAzMSAxMy40MDMxVjEzLjQ1ODZDNC40ODAzMSAxNi43ODM2IDYuNzg4OTggMTkuNTU0NyAxMC4xMjY5IDE5LjU1NDdDMTIuMzUyNyAxOS41NTQ3IDEzLjcxNSAxOC42Njc1IDE1LjI0NDUgMTcuMjgxOUwxNy45NzA2IDIwLjAyNkMxNS45Njc5IDIyLjE1OTEgMTMuNzQyMSAyMy40ODkxIDkuOTg2NjkgMjMuNDg5MUM0LjI1NzI1IDIzLjQ4OTEgMCAxOS4wODMzIDAgMTMuNTE0MkgwLjAwMTU5MzI4WiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNMjMuMzg2NCA0Ljk5OTUzVjQuOTk3OTRMMjIuMTQ1MiAzLjc2MDAxSDIyLjE0MzdIMTkuMTU3OEgxOS4xNTYyVjYuNzQyMTZMMTkuMTU3OCA2Ljc0Mzc0VjIzLjE1NTlIMjMuMzg2NFYxMC45NTU5TDM1LjYzNTYgMjMuMTU1OUgzOC42MjYyVjIwLjE4MDFMMjMuMzg2NCA0Ljk5OTUzWiIgZmlsbD0iIzAwMUU1QSIvPgo8cGF0aCBkPSJNNTEuNTMyMiAxMy4wMTU5QzUyLjkyMzEgMTIuMjM5OCA1NC4wOTEgMTEuMDIxIDU0LjA5MSA4LjgzMjM2VjguNzc2ODFDNTQuMDkxIDcuNDQ2ODIgNTMuNjQ2NSA2LjM2NjAxIDUyLjc1NTggNS40Nzg4M0M1MS42NDM3IDQuMzcxMDQgNDkuODkxMSAzLjc2MDAxIDQ3LjY2NTMgMy43NjAwMUgzOC42MjVWMjAuMTgwMUw0MS42MTI0IDIzLjE1NTlINDcuODg2OEM1Mi4yODEgMjMuMTU1OSA1NS4xNzQ0IDIxLjM4MzEgNTUuMTc0NCAxNy44MzU5VjE3Ljc4MDRDNTUuMTc0NCAxNS4xNzYgNTMuNzgzNSAxMy44NzMgNTEuNTMwNiAxMy4wMTQzSDUxLjUzMjJWMTMuMDE1OVpNNDIuNzk3OCA3LjUwMDc4SDQ3LjAyNjRDNDguODM0OCA3LjUwMDc4IDQ5LjgzNTMgOC4yMjEzMiA0OS44MzUzIDkuNDk1NzZWOS41NTEzMUM0OS44MzUzIDEwLjk5MjQgNDguNjM4OCAxMS42MDE4IDQ2Ljc0NzYgMTEuNjAxOEg0Mi43OTc4VjcuNTAwNzhaTTUwLjkyMDQgMTcuMzEwNkM1MC45MjA0IDE4Ljc1MTcgNDkuNzc5NiAxOS40MTY3IDQ3Ljg4ODMgMTkuNDE2N0g0Mi43OTc4VjE1LjE0OUg0Ny43NDk3QzQ5Ljk0NjkgMTUuMTQ5IDUwLjkyMDQgMTUuOTUyIDUwLjkyMDQgMTcuMjU1MVYxNy4zMTA2WiIgZmlsbD0iIzAwMUU1QSIvPgo8L2c+CjxkZWZzIGZpbGw9IiMwMDAwMDAiPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzE0ODQyXzI5MTM3IiBmaWxsPSIjMDAwMDAwIj4KPHJlY3Qgd2lkdGg9Ijc0IiBoZWlnaHQ9IjM2IiBmaWxsPSIjZmZmZmZmIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+',
    language: 'Indonesia'
  }
];