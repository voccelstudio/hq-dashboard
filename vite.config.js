import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // BASE_URL:
  // - Local dev / preview: '/'
  // - GitHub Pages user/org site (user.github.io): '/'
  // - GitHub Pages project site (user.github.io/sys-dashboard): '/sys-dashboard/'
  // Se controla con la variable VITE_BASE_URL en .env o flag de CLI.
  const base = env.VITE_BASE_URL || '/';

  return {
    base,
    server: {
      port: 5173,
      host: true, // permite acceso desde otros dispositivos en la red local (probar en celu)
      open: false
    },
    preview: {
      port: 4173,
      host: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  };
});
