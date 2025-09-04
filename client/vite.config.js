// client/vite.config.js

import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import checker from 'vite-plugin-checker';
import tailwindcss from '@tailwindcss/vite';
import * as path from 'node:path';

export default defineConfig({
   base: './', // Ensure this matches your deployment environment if necessary
   plugins: [
      wasm(),
      checker({
         // Enable type checking during development
         typescript: {
            tsconfigPath: './tsconfig.json',
            buildMode: true, // Run type checking during build
         },
         overlay: {
            initialIsOpen: true, // Show errors immediately
         },
         terminal: true, // Show errors in terminal
      }),
      tailwindcss(),
   ],
   resolve: {
      alias: {
         shared: path.resolve(__dirname, '../shared/src'),
      },
   },
   build: {
      outDir: 'dist', // Output directory for production build
      assetsDir: 'assets', // Directory for static assets
      target: ['esnext'], // Needed for WebAssembly
      sourcemap: true,
      rollupOptions: {
         input: {
            main: './src/index.html', // Entry point of your application
         },
      },
   },
   server: {
      port: 9000,
   },
   optimizeDeps: {
      exclude: ['@dimforge/rapier2d-compat'], // Exclude Rapier from dependency optimization
   },
});
