import fs from 'fs';
import path from 'path';

global.window = {
  currentLang: 'ar',
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  location: { hash: '' },
  eruda: null
};
global.document = {
  documentElement: { classList: { add: () => {}, remove: () => {} }, dir: 'rtl' },
  getElementById: () => ({ classList: { add:()=>{}, remove:()=>{} }, innerHTML: '', appendChild: () => {}, style: {} }),
  createElement: () => ({ classList: { add:()=>{}, remove:()=>{} }, style: {}, appendChild: ()=>{} }),
  addEventListener: () => {},
  body: { appendChild: () => {} }
};
global.localStorage = { getItem: () => null, setItem: () => {}, clear: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, clear: () => {} };
Object.defineProperty(global, 'navigator', { value: { userAgent: '' }, writable: true });
global.location = { hash: '' };
global.history = { pushState: () => {} };
global.alert = () => {};

async function testImports() {
  const jsDir = path.join(process.cwd(), 'js');
  async function walk(dir) {
    let files = await fs.promises.readdir(dir);
    for (let file of files) {
      let fullPath = path.join(dir, file);
      let stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await walk(fullPath);
      } else if (fullPath.endsWith('.js')) {
        try {
          await import('file://' + fullPath);
        } catch (e) {
          console.error('ERROR in', fullPath, ':', e.stack || e);
        }
      }
    }
  }
  await walk(jsDir);
}
testImports();
