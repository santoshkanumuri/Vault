'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const PREDEFINED_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#247BA0', 
  '#F07167', '#009FB7', '#6967CE', '#C62E65', '#F4A261',
  '#E76F51', '#2A9D8F', '#264653', '#E9C46A', '#B565A7'
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
