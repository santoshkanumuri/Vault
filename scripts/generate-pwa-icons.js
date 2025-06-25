#!/usr/bin/env node

/**
 * PWA Icon Generator
 * 
 * This script helps generate all required PWA icons from a single source image.
 * For production use, you should use proper icon generation tools like:
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 * - https://favicon.io/favicon-generator/
 */

const fs = require('fs');
const path = require('path');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate placeholder SVG icons
iconSizes.forEach(size => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#gradient)" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" fill="white" text-anchor="middle" dominant-baseline="central">LS</text>
</svg>`;
  
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svg);
});

console.log('✅ Generated placeholder SVG icons');
console.log('📝 To create proper PNG icons:');
console.log('1. Use an online tool like https://realfavicongenerator.net/');
console.log('2. Or use ImageMagick: convert icon.svg -resize 192x192 icon-192x192.png');
console.log('3. Or use an online PWA icon generator');
console.log('');
console.log('Generated icons:');
iconSizes.forEach(size => {
  console.log(`- icon-${size}x${size}.svg`);
});

// Generate a simple favicon
const favicon = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#667eea" rx="3.2"/>
  <text x="16" y="16" font-family="Arial, sans-serif" font-size="9.6" fill="white" text-anchor="middle" dominant-baseline="central">LS</text>
</svg>`;

fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), favicon);
console.log('✅ Generated favicon.svg');
