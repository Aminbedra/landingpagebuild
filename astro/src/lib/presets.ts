// Static style presets (Phase 8) — mirrors worker/src/lib/presets.ts.
// Duplicated, not imported: astro/ and worker/ are separate npm projects
// with no shared package, the same reason MarketConfig already has
// independent copies across this codebase. Keep both in sync by hand if
// these ever change.

export interface StylePreset {
  id: string
  name: string
  description: string
  colors: {
    background: string
    surface: string
    primary: string
    primaryText: string
    heading: string
    body: string
    muted: string
    border: string
  }
  fonts: {
    heading: string
    body: string
  }
  layout: 'centered' | 'left-aligned' | 'split'
  borderRadius: 'none' | 'small' | 'large'
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean and professional. Works for any industry.',
    colors: {
      background: '#ffffff',
      surface: '#f9fafb',
      primary: '#4f46e5',
      primaryText: '#ffffff',
      heading: '#111827',
      body: '#374151',
      muted: '#6b7280',
      border: '#e5e7eb',
    },
    fonts: { heading: 'Inter', body: 'Inter' },
    layout: 'centered',
    borderRadius: 'small',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High contrast and striking. Good for agencies and tech.',
    colors: {
      background: '#0f172a',
      surface: '#1e293b',
      primary: '#6366f1',
      primaryText: '#ffffff',
      heading: '#f8fafc',
      body: '#cbd5e1',
      muted: '#94a3b8',
      border: '#334155',
    },
    fonts: { heading: 'Syne', body: 'Inter' },
    layout: 'left-aligned',
    borderRadius: 'small',
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Earthy and approachable. Good for retail, food, wellness.',
    colors: {
      background: '#fffbf5',
      surface: '#fef3c7',
      primary: '#d97706',
      primaryText: '#ffffff',
      heading: '#1c1917',
      body: '#44403c',
      muted: '#78716c',
      border: '#e7e5e4',
    },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    layout: 'centered',
    borderRadius: 'large',
  },
  {
    id: 'fresh',
    name: 'Fresh',
    description: 'Light and modern. Good for SaaS, health, finance.',
    colors: {
      background: '#f0fdf4',
      surface: '#ffffff',
      primary: '#16a34a',
      primaryText: '#ffffff',
      heading: '#14532d',
      body: '#1e3a2f',
      muted: '#4b7a5f',
      border: '#d1fae5',
    },
    fonts: { heading: 'DM Sans', body: 'DM Sans' },
    layout: 'centered',
    borderRadius: 'large',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Stripped back and editorial. Good for consultants, law, finance.',
    colors: {
      background: '#ffffff',
      surface: '#fafafa',
      primary: '#18181b',
      primaryText: '#ffffff',
      heading: '#09090b',
      body: '#3f3f46',
      muted: '#71717a',
      border: '#e4e4e7',
    },
    fonts: { heading: 'DM Serif Display', body: 'DM Sans' },
    layout: 'left-aligned',
    borderRadius: 'none',
  },
]

export function getPreset(id: string | undefined): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0]
}
