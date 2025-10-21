import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  console.log('[Vite] Building with mode:', mode)
  console.log('[Vite] VITE_AUTH0_DOMAIN:', env.VITE_AUTH0_DOMAIN)
  console.log('[Vite] VITE_AUTH0_CLIENT_ID:', env.VITE_AUTH0_CLIENT_ID)

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: "dist-react",
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: undefined,
        }
      }
    },
    define: {
      'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify(env.VITE_AUTH0_DOMAIN),
      'import.meta.env.VITE_AUTH0_CLIENT_ID': JSON.stringify(env.VITE_AUTH0_CLIENT_ID),
    }
  }
})
