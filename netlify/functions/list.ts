import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import {
  authenticate,
  unauthorizedResponse,
  successResponse,
  errorResponse,
  corsHeaders,
  decodeHtmlEntities,
  RSS_SOURCES
} from './shared/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ListItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
}

// ─── Parsers ───────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseItems(data: any, source: any): ListItem[] {
  const items = data.rss?.channel?.[0]?.item || [];
  return items.map((item: any) => ({
    title: decodeHtmlEntities(
      (item.title?.[0]?._ || item.title?.[0] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    ),
    description: stripHtml(
      (item.description?.[0]?._ || item.description?.[0] || '').replace(/<!\[CDATA\[|\]\]>/g, '')
    ),
    link: item.link?.[0] || '',
    pubDate: item.pubDate?.[0] || '',
    source: source.name
  }));
}

async function fetchRSSList(source: any): Promise<ListItem[]> {
  try {
    const response = await axios.get(source.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const parsed = await parseStringPromise(response.data);
    return parseItems(parsed, source);
  } catch (error) {
    console.error(`Error fetching ${source.name}:`, error);
    return [];
  }
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

  // Optional query params: ?source=Detik&limit=50
  const params = event.queryStringParameters || {};
  const sourceFilter = params.source || '';
  const limit = Math.min(parseInt(params.limit || '200', 10), 500);

  try {
    const sources = sourceFilter
      ? RSS_SOURCES.filter(s => s.name.toLowerCase() === sourceFilter.toLowerCase())
      : RSS_SOURCES;

    if (sourceFilter && sources.length === 0) {
      return errorResponse(400, `Sumber tidak dikenali. Tersedia: ${RSS_SOURCES.map(s => s.name).join(', ')}`);
    }

    const allResults = await Promise.all(sources.map(s => fetchRSSList(s)));
    const merged = allResults.flat();

    // Sort newest first
    merged.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const data = merged.slice(0, limit);

    return successResponse({
      success: true,
      count: data.length,
      total: merged.length,
      filters: {
        source: sourceFilter || 'semua',
        limit
      },
      data
    });
  } catch (error: any) {
    console.error('Error fetching list:', error);
    return errorResponse(500, 'Gagal mengambil data berita');
  }
};