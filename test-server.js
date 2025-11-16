/**
 * Simple HTTP Server for Testing LIFF Pages Locally
 * Usage: node test-server.js
 * Then open: http://localhost:3001/liff/water-tracking.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Remove query string
  let filePath = req.url.split('?')[0];

  // Remove trailing slash
  if (filePath.endsWith('/') && filePath !== '/') {
    filePath = filePath.slice(0, -1);
  }

  // Map URL to file path
  let fullPath;

  if (filePath === '/' || filePath === '') {
    fullPath = path.join(PUBLIC_DIR, 'liff', 'index.html');
  } else if (filePath.startsWith('/liff/')) {
    // Remove /liff prefix
    const relativePath = filePath.substring(5); // Remove '/liff'
    fullPath = path.join(PUBLIC_DIR, 'liff', relativePath);

    // If no extension, assume .html
    if (!path.extname(fullPath)) {
      fullPath += '.html';
    }
  } else {
    fullPath = path.join(PUBLIC_DIR, filePath);
  }

  // Security: prevent directory traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Read and serve file
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error(`  → 404 Not Found: ${fullPath}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 Not Found</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    h1 { color: #e74c3c; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>404 Not Found</h1>
  <p>File not found: <code>${filePath}</code></p>
  <p>Looking for: <code>${fullPath}</code></p>
  <hr>
  <p>Try these pages:</p>
  <ul>
    <li><a href="/liff/water-tracking.html">Water Tracking</a></li>
    <li><a href="/liff/medications.html">Medications</a></li>
    <li><a href="/liff/reminders.html">Reminders</a></li>
    <li><a href="/liff/patient-profile.html">Patient Profile</a></li>
    <li><a href="/liff/settings.html">Settings</a></li>
  </ul>
</body>
</html>
        `);
      } else {
        console.error(`  → 500 Server Error: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    console.log(`  → 200 OK (${contentType})`);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*' // Allow CORS for testing
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 LIFF Pages Test Server Started!');
  console.log('='.repeat(60));
  console.log(`\n📍 Server running at: http://localhost:${PORT}/\n`);
  console.log('📄 Test these pages:\n');
  console.log(`   🆕 Water Tracking:   http://localhost:${PORT}/liff/water-tracking.html`);
  console.log(`   💊 Medications:      http://localhost:${PORT}/liff/medications.html`);
  console.log(`   ⏰ Reminders:        http://localhost:${PORT}/liff/reminders.html`);
  console.log(`   👤 Patient Profile:  http://localhost:${PORT}/liff/patient-profile.html`);
  console.log(`   ⚙️  Settings:         http://localhost:${PORT}/liff/settings.html`);
  console.log('\n' + '='.repeat(60));
  console.log('Press Ctrl+C to stop\n');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
