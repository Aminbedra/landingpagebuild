export interface Env {
  // D1 — relational data
  DB: D1Database

  // KV — config, cache, market copy
  KV: KVNamespace

  // KV — session tokens
  SESSIONS: KVNamespace

  // R2 — media assets (Phase 6, uncomment when enabled)
  // ASSETS: R2Bucket

  // Vars
  ENVIRONMENT: 'production' | 'staging'
  APP_URL: string

  // Secrets — set via: wrangler secret put SECRET_NAME
  JWT_SECRET: string
  ANTHROPIC_API_KEY: string
  RESEND_API_KEY: string       // Phase 5
  NOTIFICATION_TO_EMAIL: string // Phase 5 — lead notification recipient
  STRIPE_SECRET_KEY: string    // Stripe integration pending
  STRIPE_WEBHOOK_SECRET: string
}

// ── Shared response shape ────────────────────────────────────────────────────

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: number }

// ── Domain models ────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'client_admin' | 'viewer'
export type WebsiteStatus = 'draft' | 'published' | 'archived'
export type WebsitePlan = 'free' | 'basic' | 'pro' | 'agency'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

export interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Website {
  id: string
  user_id: string
  name: string
  description: string | null
  status: WebsiteStatus
  plan: WebsitePlan
  subdomain: string | null
  custom_domain: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface Page {
  id: string
  website_id: string
  name: string
  slug: string
  content: string | null
  is_published: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  website_id: string
  page_id: string | null
  name: string | null
  email: string | null
  message: string | null
  source_url: string | null
  metadata: string | null
  created_at: string
}

export interface Version {
  id: string
  website_id: string
  page_id: string | null
  snapshot: string
  label: string | null
  created_at: string
}

// ── JWT payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string       // user id
  email: string
  role: UserRole
  iat: number
  exp: number
}
