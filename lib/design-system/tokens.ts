export const designTokens = {
  radius: {
    xs: '6px',
    sm: '8px',
    md: '14px',
    lg: '22px',
    full: '999px'
  },
  spacing: {
    hairline: '1px',
    compact: '8px',
    control: '12px',
    panel: '20px',
    section: '32px',
    workspace: '40px'
  },
  motion: {
    instant: '80ms',
    fast: '120ms',
    normal: '180ms',
    slow: '240ms'
  },
  elevation: {
    flat: 'none',
    panel: '0 18px 45px rgba(15, 23, 42, 0.08)',
    overlay: '0 24px 70px rgba(15, 23, 42, 0.16)'
  },
  density: {
    compact: 'compact',
    comfortable: 'comfortable',
    spacious: 'spacious'
  }
} as const;

export type DesignTokens = typeof designTokens;
export type RadiusToken = keyof DesignTokens['radius'];
export type SpacingToken = keyof DesignTokens['spacing'];
export type MotionToken = keyof DesignTokens['motion'];
export type ElevationToken = keyof DesignTokens['elevation'];
export type DensityToken = keyof DesignTokens['density'];
