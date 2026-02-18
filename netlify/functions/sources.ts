import type { Handler } from '@netlify/functions';
import {
  authenticate,
  unauthorizedResponse,
  successResponse,
  corsHeaders,
  RSS_SOURCES
} from './shared/utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!authenticate(event)) return unauthorizedResponse();

  return successResponse({
    success: true,
    data: RSS_SOURCES.map(s => ({
      name: s.name,
      logo: s.logo,
      logoUrl: s.logoUrl,
      language: s.language
    }))
  });
};