import fs from 'fs';
let content = fs.readFileSync('index.html', 'utf8');
content = content.replace(/<!-- أداة Eruda Console للموبايل \(وضع التعديل والتصحيح\) -->[\s\S]*?<\/script>/, '');
content = content.replace(/<script>\s*\(function \(\) \{\s*<\/script>/, '');
fs.writeFileSync('index.html', content);
