import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable", url: "http://localhost:3000/" });

dom.window.addEventListener('error', (err) => {
  if (err.message && err.message.includes('matchMedia')) return;
  console.log('JSDOM ERROR:', err.error || err.message);
});

dom.window.addEventListener('unhandledrejection', (err) => {
  console.log('JSDOM UNHANDLED REJECTION:', err.reason);
});

setTimeout(() => {
  console.log('JSDOM HTML after 2 seconds (first 100 chars):', dom.window.document.body.innerHTML.substring(0, 100));
  process.exit(0);
}, 2000);
