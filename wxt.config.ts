import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte', '@wxt-dev/auto-icons'],
  autoIcons: { baseIconPath: 'assets/icon.svg' },
  manifest: {
    name: 'moodoodle',
    description: 'Keep the designs you love. Find more like them.',
    permissions: ['contextMenus', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
  },
});
