import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Static files to copy to public
const files = [
  'index.html',
  'admin.html',
  'style.css',
  'admin.css',
  'app.js',
  'admin.js',
];

for (const file of files) {
  const src = path.join(__dirname, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// Copy assets folder
const assetsSrc = path.join(__dirname, 'assets');
const assetsDest = path.join(publicDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  if (!fs.existsSync(assetsDest)) {
    fs.mkdirSync(assetsDest, { recursive: true });
  }
  const assets = fs.readdirSync(assetsSrc);
  for (const asset of assets) {
    fs.copyFileSync(path.join(assetsSrc, asset), path.join(assetsDest, asset));
  }
}

// Also copy any root PNG images (e.g. Box mal.png, etc.)
const rootFiles = fs.readdirSync(__dirname);
for (const rf of rootFiles) {
  if (rf.endsWith('.png') && !rf.startsWith('.')) {
    fs.copyFileSync(path.join(__dirname, rf), path.join(publicDir, rf));
  }
}

console.log('Build complete: generated public output directory with all static assets.');
