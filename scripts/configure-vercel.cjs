const fs = require('node:fs');
const path = require('node:path');
const raw = process.env.RENDER_BACKEND_ORIGIN;
if (!raw) throw new Error('Set RENDER_BACKEND_ORIGIN to the actual HTTPS Render origin before generating deployment config.');
const url = new URL(raw);
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw new Error('RENDER_BACKEND_ORIGIN must be an HTTPS origin without credentials, path, query or fragment.');
}
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  rewrites: [
    { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
    { source: '/health', destination: `${url.origin}/health` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
const output = path.join(__dirname, '..', 'frontend', 'vercel.json');
if (fs.existsSync(output)) throw new Error('frontend/vercel.json already exists; review it before replacing it.');
fs.writeFileSync(output, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
console.log(`Generated ${output}. Review and deploy only after approval.`);
