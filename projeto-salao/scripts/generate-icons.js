const fs = require('fs');
const path = require('path');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f4ecdf;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e8dcc8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g transform="translate(256, 256)">
    <circle cx="0" cy="-20" r="80" fill="none" stroke="#8c5a2d" stroke-width="12"/>
    <path d="M -60 40 Q -30 80 0 60 Q 30 80 60 40" fill="none" stroke="#8c5a2d" stroke-width="12" stroke-linecap="round"/>
    <circle cx="0" cy="-20" r="20" fill="#8c5a2d"/>
  </g>
</svg>`;

const sizes = [192, 512, 180];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

sizes.forEach(size => {
  const filename = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  const svgPath = path.join(iconsDir, `icon-${size}.svg`);
  
  fs.writeFileSync(svgPath, svgContent);
  console.log(`Created ${filename} (SVG source)`);
});

console.log('SVG icons created. Convert to PNG using an online converter or sharp library.');
