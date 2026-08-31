// Static copy templates (Phase 8) — pre-written per-industry starting
// copy, selectable from the admin panel's Presets tab to populate the
// Copy Editor's fields (not auto-saved). Served via GET
// /api/admin/copy-templates rather than duplicated into the admin panel
// build — unlike style presets, which the brief explicitly allows
// duplicating, there's no reason not to just fetch these from one source
// of truth since a dedicated endpoint exists for them.

export interface CopyTemplate {
  id: string
  industry: string
  headline: string
  subheadline: string
  body: string
  ctaText: string
}

export const COPY_TEMPLATES: CopyTemplate[] = [
  {
    id: 'agency',
    industry: 'Marketing Agency',
    headline: 'We grow brands that mean something.',
    subheadline: 'Strategy, creative, and performance — under one roof.',
    body: 'We work with ambitious brands who want more than impressions. Our team delivers campaigns that connect with real people and drive measurable results.',
    ctaText: 'Start a conversation',
  },
  {
    id: 'saas',
    industry: 'SaaS / Software',
    headline: 'The tool your team will actually use.',
    subheadline: 'Simple to start. Powerful as you grow.',
    body: 'Built for teams who want results without complexity. Get set up in minutes, connect your existing tools, and see why thousands of teams switched.',
    ctaText: 'Try it free',
  },
  {
    id: 'consultancy',
    industry: 'Consultancy / Professional Services',
    headline: 'Expert advice. Practical outcomes.',
    subheadline: 'We help organisations make better decisions, faster.',
    body: 'With deep sector experience and a no-nonsense approach, we work alongside your team to solve the problems that matter most.',
    ctaText: 'Book a call',
  },
  {
    id: 'ecommerce',
    industry: 'eCommerce / Retail',
    headline: 'Products people love. Delivered fast.',
    subheadline: 'Quality you can trust, every single order.',
    body: "We obsess over the details so you don't have to. From sourcing to delivery, every step is handled with care.",
    ctaText: 'Shop now',
  },
  {
    id: 'health',
    industry: 'Health & Wellness',
    headline: 'Feel better. Live better.',
    subheadline: 'Science-backed. Human-centred.',
    body: 'We believe wellbeing should be accessible to everyone. Our programmes are designed by experts and built around your life, not the other way around.',
    ctaText: 'Get started today',
  },
  {
    id: 'finance',
    industry: 'Finance / Fintech',
    headline: 'Your money, working harder.',
    subheadline: 'Clear advice. No jargon. No hidden fees.',
    body: "We cut through the complexity of financial planning so you can focus on what matters. Transparent fees, personalised guidance, and a team that's always in your corner.",
    ctaText: 'See how it works',
  },
  {
    id: 'property',
    industry: 'Property / Real Estate',
    headline: "Find the place you'll call home.",
    subheadline: 'Local expertise. Personal service.',
    body: 'Buying, selling, or letting — we guide you through every step with honest advice and deep local knowledge. No pressure. Just results.',
    ctaText: 'Start your search',
  },
  {
    id: 'hospitality',
    industry: 'Hospitality / Events',
    headline: 'Experiences worth remembering.',
    subheadline: 'Every detail handled. Every guest delighted.',
    body: 'From intimate gatherings to large-scale events, we bring your vision to life with precision and warmth. Your guests deserve the best.',
    ctaText: 'Enquire now',
  },
]
