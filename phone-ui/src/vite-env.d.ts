/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JARVIS_SERVER_URL?: string;
  readonly VITE_JARVIS_PHONE_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
