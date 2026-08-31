/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Server-side Cloudflare bindings — declared in wrangler.toml, reachable via
// `import { env } from 'cloudflare:workers'` (Astro.locals.runtime.env was
// removed by @astrojs/cloudflare in favor of this — see src/lib/kv.ts).
declare namespace Cloudflare {
  interface Env {
    KV: KVNamespace
  }
}

// Public, build-time env — inlined by Vite from .env, available in both
// server code (import.meta.env) and client islands.
interface ImportMetaEnv {
  readonly PUBLIC_WORKER_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
