import { useState, useEffect, useCallback } from 'react';

export type FontSize = 'small' | 'normal' | 'large' | 'extra-large';

// Map font size names to scale values (strings for data attributes)
const SCALE_VALUES: Record<FontSize, string> = {
  'small': '0.85',
  'normal': '1',
  'large': '1.2',
  'extra-large': '1.4',
};

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  'small': 'S',
  'normal': 'M',
  'large': 'L',
  'extra-large': 'XL',
};

const FONT_SIZE_KEY = 'erlbrew_font_size';

export function getStoredFontSize(): FontSize {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored && (stored === 'small' || stored === 'normal' || stored === 'large' || stored === 'extra-large')) {
      return stored;
    }
  } catch {}
  return 'normal';
}

export function setStoredFontSize(size: FontSize) {
  try {
    localStorage.setItem(FONT_SIZE_KEY, size);
    applyFontSize(size);
  } catch {}
}

export function applyFontSize(size: FontSize) {
  const scale = SCALE_VALUES[size];
  document.documentElement.setAttribute('data-app-scale', scale);
  document.documentElement.setAttribute('data-font-scale', scale);
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>(getStoredFontSize);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    setStoredFontSize(size);
  }, []);

  // Apply on mount and when changed
  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  return { fontSize, setFontSize };
}

export { SCALE_VALUES, FONT_SIZE_LABELS };