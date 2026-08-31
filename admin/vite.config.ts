import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plain Vite + React static build for the admin panel — deliberately NOT an
// Astro project. See ../astro/wrangler.toml for why: @astrojs/cloudflare
// generates a Pages Functions worker (with a reserved `ASSETS` binding) for
// any project with an SSR route, and that bug blocks `wrangler pages
// deploy` outright (withastro/astro#16107). This panel has no SSR route —
// it's pure client-side, calling the Worker API over HTTPS — so it doesn't
// need Astro's adapter at all. A plain static build sidesteps the bug
// entirely instead of working around it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Mirrors Astro's convention (astro/src/env.d.ts) so PUBLIC_* vars stay
  // named the same across both projects.
  envPrefix: 'PUBLIC_',
})
