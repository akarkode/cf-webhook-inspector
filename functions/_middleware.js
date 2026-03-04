const MAX_BODY_LENGTH = 500;
const MAX_LOG_ENTRIES = 200;

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Do not log requests to the inspector endpoints themselves
  if (url.pathname === '/logs' || url.pathname === '/clear') {
    return next();
  }

  const timestamp = new Date().toISOString();
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
      const raw = await env.LOGS.get('webhook_logs');
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift(entry);
      await env.LOGS.put('webhook_logs', JSON.stringify(logs.slice(0, MAX_LOG_ENTRIES)));
    } catch (_) {}
  }

  return response;
}
