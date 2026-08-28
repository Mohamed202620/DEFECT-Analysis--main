const fs = require('fs');
const path = 'js/services/exportUtility.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\$\{/g, '${');

fs.writeFileSync(path, content, 'utf8');
