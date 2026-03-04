const LOG_PREFIX = 'log:';

async function deleteAllLogs(env) {
  let cursor;
  do {
    const res = await env.LOGS.list({ prefix: LOG_PREFIX, cursor, limit: 1000 });
    if (res.keys.length) {
      await Promise.all(res.keys.map(({ name }) => env.LOGS.delete(name)));
    }
    cursor = res.list_complete ? null : res.cursor;
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
