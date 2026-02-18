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
  RSS_SOURCES,
  type RSSItem
} from './shared/utils';

// ─── Parsers ───────────────────────────────────────────────────────────────

function parseDetikRSS(data: any, source: any): RSSItem[] {
  const items = data.rss?.channel?.[0]?.item || [];
  return items.map((item: any) => ({
    title: decodeHtmlEntities(item.title?.[0]?._ || item.title?.[0] || ''),
    description: item.description?.[0]?._ || item.description?.[0] || '',
    link: item.link?.[0] || '',
    pubDate: item.pubDate?.[0] || '',
    image: item.enclosure?.[0]?.$?.url || '',
    source: source.name,
    logo: source.logo,
    logoUrl: source.logoUrl,
    language: source.language
  }));
}

function parseTempoRSS(data: any, source: any): RSSItem[] {
  const items = data.rss?.channel?.[0]?.item || [];
  return items.map((item: any) => ({
    title: decodeHtmlEntities(item.title?.[0] || ''),
    description: item.description?.[0]?._ || item.description?.[0] || '',
    link: item.link?.[0] || '',
    pubDate: item.pubDate?.[0] || '',
    image: item.img?.[0] || '',
    source: source.name,
    logo: source.logo,
    logoUrl: source.logoUrl,
    language: source.language
  }));
}

function parseCNBCRSS(data: any, source: any): RSSItem[] {
  const items = data.rss?.channel?.[0]?.item || [];
  return items.map((item: any) => ({
    title: decodeHtmlEntities(item.title?.[0] || ''),
    description: item.description?.[0]?._ || item.description?.[0] || '',
    link: item.link?.[0] || '',
    pubDate: item.pubDate?.[0] || '',
    image: item.enclosure?.[0]?.$?.url || item['media:content']?.[0]?.$?.url || '',
    source: source.name,
    logo: source.logo,
    logoUrl: source.logoUrl,
    language: source.language
  }));
}

async function fetchRSS(source: any): Promise<RSSItem[]> {
  try {
    const response = await axios.get(source.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const parsed = await parseStringPromise(response.data);

    if (source.name === 'Detik') return parseDetikRSS(parsed, source);
    if (source.name === 'Tempo') return parseTempoRSS(parsed, source);
    if (source.name === 'CNBC Indonesia') return parseCNBCRSS(parsed, source);

    return [];
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

  try {
    const allFeeds = await Promise.all(RSS_SOURCES.map(source => fetchRSS(source)));
    const mergedFeeds = allFeeds.flat();

    // Sort by date, newest first
    mergedFeeds.sort((a, b) => {
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    return successResponse({
      success: true,
      count: mergedFeeds.length,
      data: mergedFeeds
    });
  } catch (error: any) {
    console.error('Error fetching feeds:', error);
    return errorResponse(500, 'Failed to fetch RSS feeds');
  }
};