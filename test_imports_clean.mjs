import fs from 'fs';
import path from 'path';

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
          if (e.name === 'SyntaxError') {
             console.error('SYNTAX ERROR in', fullPath, ':', e.message);
          }
        }
      }
    }
  }
  await walk(jsDir);
}
testImports();
