/**
 * Centralized Design System Configuration
 * Defines all colors, spacing, typography, and component patterns
 */

export const COLORS = {
  // Primary Brand Colors
  primary: '#6366f1',        // Indigo (Admin)
  primaryAlt: '#f59e0b',     // Amber (Super Admin)
  
  // Status Colors
  status: {
    open: '#6366f1',
    pending: '#f59e0b',
    solved: '#10b981',
    merged: '#64748b',
  },
  
  // Priority Colors
  priority: {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    urgent: '#ef4444',
  },
  
  // Semantic Colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#6366f1',
  
  // Neutral Colors
  white: '#ffffff',
  black: '#000000',
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
}

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
}

export const BORDER_RADIUS = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
}

export const SHADOWS = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px rgba(0,0,0,0.1)',
  lg: '0 8px 16px rgba(0,0,0,0.15)',
  xl: '0 12px 24px rgba(0,0,0,0.2)',
  '2xl': '0 20px 40px rgba(0,0,0,0.3)',
  card: '0 2px 8px rgba(0,0,0,0.12)',
  cardHover: '0 8px 32px rgba(0,0,0,0.3)',
}

export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
}

export const TYPOGRAPHY = {
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
}

/**
 * Badge Factory - Creates consistent badge styles
 */
export const createBadgeStyle = (type, theme = 'indigo') => {
  const colorMap = {
    indigo: { dot: '#6366f1', color: '#818cf8', light: '#818cf8', bg: '#6366f1' },
    amber: { dot: '#f59e0b', color: '#fbbf24', light: '#fbbf24', bg: '#f59e0b' },
    green: { dot: '#10b981', color: '#34d399', light: '#34d399', bg: '#10b981' },
    slate: { dot: '#64748b', color: '#94a3b8', light: '#94a3b8', bg: '#64748b' },
    red: { dot: '#ef4444', color: '#f87171', light: '#f87171', bg: '#ef4444' },
    orange: { dot: '#f97316', color: '#fb923c', light: '#fb923c', bg: '#f97316' },
    yellow: { dot: '#eab308', color: '#facc15', light: '#facc15', bg: '#eab308' },
  }
  
  const colors = colorMap[theme] || colorMap.indigo
  
  return {
    background: `${colors.bg}15`,
    color: colors.light,
    border: `1px solid ${colors.bg}35`,
    dot: colors.dot,
  }
}

/**
 * Status Badge Styles
 */
export const STATUS_BADGE_STYLES = {
  opened: { label: 'Open', ...createBadgeStyle('status', 'indigo') },
  pending: { label: 'Pending', ...createBadgeStyle('status', 'amber') },
  solved: { label: 'Solved', ...createBadgeStyle('status', 'green') },
  merged: { label: 'Merged', ...createBadgeStyle('status', 'slate') },
}

/**
 * Priority Badge Styles
 */
export const PRIORITY_BADGE_STYLES = {
  low: { 
    label: 'Low', 
    color: '#22c55e',
    background: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
    glow: '0 0 12px rgba(34,197,94,0.2)',
  },
  medium: {
    label: 'Medium',
    color: '#eab308',
    background: 'rgba(234,179,8,0.12)',
    border: 'rgba(234,179,8,0.3)',
    glow: '0 0 12px rgba(234,179,8,0.2)',
  },
  high: {
    label: 'High',
    color: '#f97316',
    background: 'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.3)',
    glow: '0 0 12px rgba(249,115,22,0.2)',
  },
  urgent: {
    label: 'Urgent',
    color: '#ef4444',
    background: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    glow: '0 0 12px rgba(239,68,68,0.2)',
  },
}

/**
 * Button Variants
 */
export const BUTTON_VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
    color: '#ffffff',
    border: 'none',
    shadow: '0 4px 16px rgba(99,102,241,0.3)',
  },
  primaryAlt: {
    background: 'linear-gradient(135deg,#f59e0b,#d97706)',
    color: '#1c1004',
    border: 'none',
    shadow: '0 4px 16px rgba(245,158,11,0.3)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.04)',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.09)',
  },
  ghost: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.1)',
  },
}

/**
 * Component Sizes
 */
export const COMPONENT_SIZES = {
  buttonSm: { padding: '6px 12px', fontSize: '12px' },
  buttonBase: { padding: '8px 16px', fontSize: '14px' },
  buttonLg: { padding: '10px 20px', fontSize: '16px' },
  
  badgeSm: { padding: '4px 8px', fontSize: '11px' },
  badgeBase: { padding: '6px 12px', fontSize: '12px' },
  badgeLg: { padding: '8px 16px', fontSize: '13px' },
}

/**
 * Background Gradients
 */
export const GRADIENTS = {
  dark: 'linear-gradient(180deg, #0c0c1a 0%, #080810 100%)',
  card: 'rgba(255,255,255,0.025)',
  hover: 'rgba(255,255,255,0.04)',
  subtle: 'rgba(255,255,255,0.02)',
}

/**
 * Borders
 */
export const BORDERS = {
  subtle: '1px solid rgba(255,255,255,0.06)',
  default: '1px solid rgba(255,255,255,0.08)',
  emphasized: '1px solid rgba(255,255,255,0.12)',
  dashed: '1px dashed rgba(255,255,255,0.1)',
}

/**
 * Accent Color Helper - Switches between admin and super admin colors
 */
export const getAccentColor = (isSuperAdmin = false) => {
  return isSuperAdmin ? COLORS.primaryAlt : COLORS.primary
}

export const getAccentGradient = (isSuperAdmin = false) => {
  return isSuperAdmin 
    ? 'linear-gradient(135deg,#d97706,#b45309)'
    : 'linear-gradient(135deg,#2563eb,#1d4ed8)'
}

export const getAccentGlow = (isSuperAdmin = false) => {
  return isSuperAdmin
    ? '0 4px 14px rgba(217,119,6,0.3)'
    : '0 4px 14px rgba(37,99,235,0.3)'
}

/**
 * Common Style Objects
 */
export const COMMON_STYLES = {
  cardBg: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' },
  inputBg: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' },
  filterBg: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' },
  emptyState: { background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' },
  divider: { borderTop: '1px solid rgba(255,255,255,0.06)' },
}
