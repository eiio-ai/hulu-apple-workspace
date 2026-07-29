const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const files = ['manifest.json','service-worker.js','icon.svg','readme.md','gen_icons.js'];

files.forEach(f => {
  const fp = path.join(dir, f);
  const content = fs.readFileSync(fp, 'utf8');
  const size = Buffer.byteLength(content, 'utf8');
  // Output as JSON line
  console.log(JSON.stringify({file: f, size: size, content: content}));
});
