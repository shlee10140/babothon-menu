import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PRODUCTION_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' https://cdn.jsdelivr.net",
  "img-src 'self' data:",
  'connect-src https://api.open-meteo.com https://open.er-api.com',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "require-trusted-types-for 'script'",
  'upgrade-insecure-requests',
].join('; ');

function injectProductionCspPlugin(): Plugin {
  return {
    name: 'inject-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), injectProductionCspPlugin()],
  build: {
    target: 'esnext',
    sourcemap: false,
  },
});
