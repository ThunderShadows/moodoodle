import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte', '@wxt-dev/auto-icons'],
  autoIcons: { baseIconPath: 'assets/icon.svg' },
  manifest: {
    name: 'moodoodle',
    description: 'Keep the designs you love. Find more like them.',
    permissions: ['contextMenus', 'offscreen', 'sidePanel', 'storage', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
    // Bundled WebAssembly (the on-device image model) needs 'wasm-unsafe-eval'; no remote code is allowed.
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" },
  },
});
