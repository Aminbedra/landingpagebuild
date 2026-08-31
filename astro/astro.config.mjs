import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // The Worker's CORS allowlist (worker/src/lib/utils.ts) only permits
  // http://localhost:3000 — keep dev on that port so the browser-side
  // ChatWidget/LeadForm islands can actually reach it.
  server: { port: 3000 },
  adapter: cloudflare({
    // No Cloudflare Images binding provisioned yet — fall back to unprocessed <img>.
    imageService: 'passthrough',
    // Lets `astro dev` hit the real staging KV namespace declared in
    // wrangler.toml instead of an empty local emulation of it.
    remoteBindings: true,
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
