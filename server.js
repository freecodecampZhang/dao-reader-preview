// 用于本地预览生产构建的只读静态服务器；公共文件仅来自 dist。
// 正式部署请使用 Cloudflare Pages，勿将仓库根目录作为静态根目录。
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 3737);
const DIST_ROOT = path.resolve(__dirname, 'dist');
if (!fs.existsSync(path.join(DIST_ROOT, 'index.html'))) {
  console.error('找不到 dist/index.html。请先运行 npm run build。');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(res, 400, 'Bad request'); }
  if (pathname.startsWith('/api/')) return send(res, 404, 'Not found');

  const requested = path.resolve(DIST_ROOT, `.${pathname}`);
  if (requested !== DIST_ROOT && !requested.startsWith(`${DIST_ROOT}${path.sep}`)) return send(res, 403, 'Forbidden');
  let file = requested;
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  } catch { /* React Router routes use the built SPA shell below. */ }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (path.extname(pathname)) return send(res, 404, 'Not found');
    file = path.join(DIST_ROOT, 'index.html');
  }

  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=0, must-revalidate' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`阅读器预览已启动: http://localhost:${PORT}`);
  const addresses = Object.values(os.networkInterfaces()).flatMap((items) => items || [])
    .filter((item) => !item.internal && (item.family === 'IPv4' || item.family === 4))
    .map((item) => item.address);
  for (const address of addresses) console.log(`局域网手机访问: http://${address}:${PORT}`);
});
