// Simple static file server for VPS deployment; no external deps required.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname); // Ensure absolute path

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // 1. Only allow GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  let urlPath;
  try {
    // 2. CRITICAL FIX: Wrap decoding in try-catch to prevent URIError crashes
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (err) {
    // If URL is malformed, return 400 Bad Request instead of crashing
    console.error(`[Error] Malformed URL from ${req.socket.remoteAddress}`);
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  // 3. Block dotfiles and hidden directories (e.g. .git, .env, .well-known)
  // Reject any path segment that starts with a dot
  if (urlPath.split(/[\\/]/).some((seg) => seg.startsWith('.'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // 4. Prevent Directory Traversal (escaping the root)
  // Resolve the full path and ensure it still starts with the ROOT directory
  const safeSuffix = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT, safeSuffix === '/' ? 'index.html' : safeSuffix);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = mimeByExt[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': type });

    // 5. Handle Stream Errors
    // If the client disconnects or the file read fails, this prevents a crash
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', (streamErr) => {
        console.error(`[Error] Stream error: ${streamErr.message}`);
        if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Server Error');
        } else {
            res.end();
        }
    });

    stream.pipe(res);
  });
});

// 6. Handle Server-level errors (e.g., port already in use)
server.on('error', (err) => {
    console.error(`[Fatal] Server error: ${err.message}`);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log(`Serving files from: ${ROOT}`);
});
