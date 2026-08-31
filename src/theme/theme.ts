/**
 * MileTrack visual language — dark, utilitarian, green accent.
 * Derived from the UI reference: near-black green-tinted ground, flat cards,
 * one bright green primary, blue + orange for the two secondary actions.
 */

export const colors = {
  bg: '#0F1512',
  bgElevated: '#161D19',
  card: '#1A221E',
  cardAlt: '#202924',
  surfaceInput: '#141A17',
  border: '#2A332D',
  borderStrong: '#38443C',

  textPrimary: '#F1F5F2',
  textSecondary: '#9AA8A0',
  textMuted: '#6B7A72',
  textInverse: '#0B0F0D',

  green: '#35D07A',
  greenDim: '#2AA863',
  greenSoft: 'rgba(53, 208, 122, 0.14)',
  blue: '#3B82F6',
  blueSoft: 'rgba(59, 130, 246, 0.16)',
  orange: '#F5893B',
  orangeSoft: 'rgba(245, 137, 59, 0.16)',

  danger: '#E5484D',
  dangerSoft: 'rgba(229, 72, 77, 0.16)',

  chartBar: '#3ECF74',
  chartBarOngoing: 'rgba(62, 207, 116, 0.38)',
  chartLine: '#4ADE80',
  chartGrid: '#242D28',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const font = {
  // system stack — RN maps this to Roboto on Android
  display: { fontSize: 52, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 19, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '700' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;
