import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Generate bundle visualization for perf hygiene work.
    // Only runs when ANALYZE=1 is set.
    process.env.ANALYZE === '1'
      ? visualizer({
          filename: 'dist/stats.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
          open: false,
        })
      : undefined,
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Keep the app stable while getting the main chunk back under Vite’s 500kB warning.
        // We can revisit for route-level code splitting later.
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Be precise here: lots of packages include "react" in their path (e.g. @chakra-ui/react).
          if (id.includes('/node_modules/react-dom/')) return 'react-dom'
          if (id.includes('/node_modules/react/')) return 'react'

          if (id.includes('@chakra-ui') || id.includes('@emotion') || id.includes('framer-motion')) return 'ui'

          return 'vendor'
        },
      },
    },
  },
})
