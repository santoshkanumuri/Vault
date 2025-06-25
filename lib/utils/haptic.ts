// Haptic feedback utilities for mobile PWA
export class HapticFeedback {
  // Check if the device supports vibration
  static isSupported(): boolean {
    return 'vibrate' in navigator && typeof navigator.vibrate === 'function';
  }

  // Light tap feedback
  static light(): void {
    if (this.isSupported()) {
      navigator.vibrate(10);
    }
  }

  // Medium tap feedback
  static medium(): void {
    if (this.isSupported()) {
      navigator.vibrate(20);
    }
  }

  // Heavy tap feedback
  static heavy(): void {
    if (this.isSupported()) {
      navigator.vibrate(50);
    }
  }

  // Success feedback pattern
  static success(): void {
    if (this.isSupported()) {
      navigator.vibrate([10, 50, 10]);
    }
  }

  // Error feedback pattern
  static error(): void {
    if (this.isSupported()) {
      navigator.vibrate([50, 50, 50]);
    }
  }

  // Warning feedback pattern
  static warning(): void {
    if (this.isSupported()) {
      navigator.vibrate([30, 30, 30, 30]);
    }
  }

  // Custom pattern
  static custom(pattern: number[]): void {
    if (this.isSupported()) {
      navigator.vibrate(pattern);
    }
  }
}

// Enhanced button press handler with haptic feedback
export function withHapticFeedback<T extends (...args: any[]) => any>(
  callback: T,
  intensity: 'light' | 'medium' | 'heavy' = 'light'
): T {
  return ((...args: Parameters<T>) => {
    HapticFeedback[intensity]();
    return callback(...args);
  }) as T;
}

// Hook for adding haptic feedback to interactions
export function useHapticFeedback() {
  return {
    light: HapticFeedback.light,
    medium: HapticFeedback.medium,
    heavy: HapticFeedback.heavy,
    success: HapticFeedback.success,
    error: HapticFeedback.error,
    warning: HapticFeedback.warning,
    custom: HapticFeedback.custom,
    isSupported: HapticFeedback.isSupported(),
  };
}
