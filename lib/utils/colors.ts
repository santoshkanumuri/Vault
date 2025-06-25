const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#A8E6CF', '#FFB3BA', '#BAFFC9',
  '#BAE1FF', '#FFFFBA', '#FFD1DC', '#E0BBE4', '#957DAD',
  '#C7CEEA', '#B19CD9', '#FFC3A0', '#FF9999', '#85C1E9'
];

const usedColors = new Set<string>();

export const generateRandomColor = (): string => {
  const availableColors = COLORS.filter(color => !usedColors.has(color));
  
  if (availableColors.length === 0) {
    usedColors.clear();
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  
  const color = availableColors[Math.floor(Math.random() * availableColors.length)];
  usedColors.add(color);
  return color;
};

export const resetColorUsage = () => {
  usedColors.clear();
};

export const getContrastColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
};