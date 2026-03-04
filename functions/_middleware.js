const MAX_BODY_LENGTH = 500;
import { LOG_PREFIX, LOG_TTL_SECONDS, INVERT_BASE } from './_constants';

function buildLogKey(now) {
  const inverted = INVERT_BASE - now;
  const tsPart = String(inverted > 0 ? inverted : 0).padStart(16, '0'); // inverted timestamp keeps newest keys first lexicographically
  const rand = crypto.randomUUID();
  return `${LOG_PREFIX}${tsPart}:${rand}`;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Do not log requests to the inspector endpoints themselves
  if (url.pathname === '/logs' || url.pathname === '/clear') {
    return next();
  }

  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const method = request.method;
  const path = url.pathname + url.search;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || '';
  const referer = request.headers.get('Referer') || '';
  const cfRay = request.headers.get('CF-Ray') || '';
  const country = request.headers.get('CF-IPCountry') || '';

  let body = '';
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const text = await request.clone().text();
      body = text.slice(0, MAX_BODY_LENGTH);
    } catch (_) {}
  }

  const response = await next();

  if (env.LOGS) {
    try {
      const entry = {
        timestamp,
        method,
        path,
        ip,
        userAgent,
        referer,
        body,
        cfRay,
        country,
        status: response.status,
      };
      await env.LOGS.put(buildLogKey(now), JSON.stringify(entry), {
        expirationTtl: LOG_TTL_SECONDS,
      });
    } catch (_) {}
  }

  return response;
}
