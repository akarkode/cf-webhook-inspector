import { LOG_PREFIX } from './_constants';

async function deleteAllLogs(env) {
  let cursor;
  do {
    const res = await env.LOGS.list({ prefix: LOG_PREFIX, cursor, limit: 1000 });
    if (res.keys.length) {
      // Delete in smaller batches to reduce per-request KV concurrency spikes.
      for (let i = 0; i < res.keys.length; i += 100) {
        const batch = res.keys.slice(i, i + 100);
        await Promise.all(batch.map(({ name }) => env.LOGS.delete(name)));
      }
    }
    cursor = res.cursor || null;
  } while (cursor);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  try {
    await deleteAllLogs(env);
    return new Response(JSON.stringify({ success: true, message: 'All logs cleared' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
