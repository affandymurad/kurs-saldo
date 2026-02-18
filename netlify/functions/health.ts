import type { Handler } from '@netlify/functions';
import { corsHeaders, successResponse } from './shared/utils';

// Handle CORS preflight
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  return successResponse({
    success: true,
    message: 'Kurs Saldo API is running',
    version: '1.0.0'
  });
};