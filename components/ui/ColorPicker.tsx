'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const PREDEFINED_COLORS = [
  // Reds & Pinks
  '#FF6B6B', '#E53E3E', '#FC8181', '#F56565', '#C62E65', '#ED64A6', '#D53F8C',
  // Oranges & Yellows  
  '#F4A261', '#E76F51', '#F07167', '#FED766', '#ECC94B', '#F6AD55', '#DD6B20',
  // Greens
  '#48BB78', '#38A169', '#2A9D8F', '#68D391', '#9AE6B4', '#276749',
  // Blues & Cyans
  '#4ECDC4', '#45B7D1', '#247BA0', '#009FB7', '#4299E1', '#3182CE', '#2B6CB0', '#0BC5EA',
  // Purples & Violets
  '#6967CE', '#805AD5', '#9F7AEA', '#B565A7', '#553C9A', '#6B46C1',
  // Neutrals & Others
  '#264653', '#4A5568', '#718096', '#A0AEC0', '#2D3748'
];

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorChange, className }) => {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {PREDEFINED_COLORS.map(color => (
        <button
          key={color}
          type="button"
          className={cn(
            "w-6 h-6 rounded-full border-2 transition-transform transform hover:scale-110",
            selectedColor.toLowerCase() === color.toLowerCase() ? 'border-primary' : 'border-transparent'
          )}
          style={{ backgroundColor: color }}
          onClick={() => onColorChange(color)}
        />
      ))}
    </div>
  );
};
