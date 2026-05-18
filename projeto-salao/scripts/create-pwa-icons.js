const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '..', 'public', 'logo-al.png');
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(logoPath)) {
  console.error('logo-al.png not found');
  process.exit(1);
}

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' }
];

sizes.forEach(({ size, name }) => {
  const destPath = path.join(iconsDir, name);
  fs.copyFileSync(logoPath, destPath);
  console.log(`Created ${name} (${size}x${size}) - copy of logo-al.png`);
});

console.log('Icons created. For production, use sharp or an online tool to resize properly.');
