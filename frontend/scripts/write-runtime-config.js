#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const target = path.join(publicDir, 'runtime-config.js');

const config = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || '',
  NEXT_BACKEND_URL: process.env.NEXT_BACKEND_URL || '',
};

const content = `window.__RUNTIME_CONFIG__ = ${JSON.stringify(config)};`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(target, content, 'utf8');
console.log(`[runtime-config] wrote ${target}`);
