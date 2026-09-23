export async function onRequest(context) {
  const response = await context.next();
  const request = context.request;
  if (request.method !== 'GET') return response;

  const url = new URL(request.url);
  const isDashboard = ['/dashboard', '/dashboard.html'].includes(url.pathname);
  const isAdmin = ['/admin', '/admin.html'].includes(url.pathname);
  if (!isDashboard && !isAdmin) return response;

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return response;

  let html = await response.text();

  if (isDashboard) {
    if (!html.includes('/portal-workflow-v2.js')) {
      html = html.replace(
        '</body>',
        '  <script type="module" src="/portal-workflow-v2.js?v=20260922-1"></script>\n</body>',
      );
    }
    if (!html.includes('/provider-workflow-copy.js')) {
      html = html.replace(
        '</body>',
        '  <script src="/provider-workflow-copy.js?v=20260922-1"></script>\n</body>',
      );
    }
  }

  if (isAdmin) {
    html = html.replace(
      '/admin-dashboard.css?v=20260922-1',
      '/admin-dashboard.css?v=20260922-2',
    );
    if (!html.includes('/admin-theme.js')) {
      html = html.replace(
        '</body>',
        '  <script src="/admin-theme.js?v=20260922-1"></script>\n</body>',
      );
    }
    if (!html.includes('/admin-email-test.js')) {
      html = html.replace(
        '</body>',
        '  <script type="module" src="/admin-email-test.js?v=20260922-1"></script>\n</body>',
      );
    }
  }

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('Cache-Control', 'no-store, max-age=0');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
