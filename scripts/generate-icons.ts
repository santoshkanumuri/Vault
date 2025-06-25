// Simple placeholder icon generator for PWA
// You should replace these with your actual app icons

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate SVG icons as placeholders
iconSizes.forEach(size => {
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#000000" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" fill="white" text-anchor="middle" dominant-baseline="middle">LS</text>
</svg>`;
  
  console.log(`Create icon-${size}x${size}.png from this SVG:`);
  console.log(svg);
  console.log('---');
});

// For now, we'll create a simple fallback
export {};
