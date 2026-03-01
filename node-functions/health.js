export default function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin');
  const allowedOrigins = (env?.ALLOWED_ORIGINS || '').trim();
  const allowAll = !allowedOrigins || allowedOrigins === '*';
  const list = allowAll
    ? []
    : allowedOrigins
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
  });

  if (allowAll) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && list.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'brew-guide-api',
      environment: env?.NODE_ENV || 'production',
      runtime: 'edgeone-node-functions',
    }),
    { status: 200, headers }
  );
}
