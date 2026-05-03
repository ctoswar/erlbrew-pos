import http from 'http';

const proxyPayload = JSON.stringify({ lines: ['Test line 1', 'Test line 2'], paperSize: '80mm' });
const proxyReq = http.request({
  hostname: '172.180.0.2',
  port: 3001,
  path: '/api/print',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(proxyPayload),
  },
  timeout: 10000,
}, (res) => {
  console.log('Backend /api/print Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Backend /api/print Body:', data));
});

proxyReq.on('error', (e) => console.error('Backend Error:', e.message));
proxyReq.on('timeout', () => { console.error('Backend Timeout'); proxyReq.destroy(); });
proxyReq.write(proxyPayload);
proxyReq.end();