/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_WORKER_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
