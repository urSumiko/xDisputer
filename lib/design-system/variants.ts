export type IntentVariant = 'neutral' | 'primary' | 'success' | 'warning';
export type SizeVariant = 'sm' | 'md' | 'lg';
export type SurfaceVariant = 'plain' | 'panel' | 'elevated' | 'muted';

export type ComponentVariantContract = {
  intent: readonly IntentVariant[];
  size: readonly SizeVariant[];
  surface: readonly SurfaceVariant[];
};

export const componentVariants = {
  commandButton: {
    intent: ['neutral', 'primary', 'success', 'warning'],
    size: ['sm', 'md', 'lg'],
    surface: ['plain', 'elevated']
  },
  commandPanel: {
    intent: ['neutral', 'primary', 'warning'],
    size: ['md', 'lg'],
    surface: ['panel', 'elevated', 'muted']
  },
  commandMetric: {
    intent: ['neutral', 'success', 'warning'],
    size: ['sm', 'md'],
    surface: ['panel', 'muted']
  }
} as const;
