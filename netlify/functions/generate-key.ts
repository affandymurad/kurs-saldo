import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { corsHeaders, successResponse, errorResponse } from './shared/utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body: { secret?: string } = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'kurs-saldo-admin-2026';

  if (body.secret !== ADMIN_SECRET) {
    return errorResponse(403, 'Invalid secret');
  }

  const newKey = crypto.randomBytes(32).toString('hex');
  return successResponse({
    success: true,
    apiKey: newKey,
    message: 'Simpan API Key ini dengan aman. Gunakan di header X-API-Key'
  });
};