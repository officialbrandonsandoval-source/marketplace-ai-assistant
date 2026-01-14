import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'copy-assets',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        copyFileSync('popup.html', 'dist/popup.html');
        
        // Ensure icons directory exists
        if (!existsSync('dist/icons')) {
          mkdirSync('dist/icons', { recursive: true });
        }
        
        // Copy icon files
        const iconSizes = [16, 32, 48, 128];
        iconSizes.forEach(size => {
          copyFileSync(
            `public/icons/icon${size}.png`,
            `dist/icons/icon${size}.png`
          );
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/background.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'src/background/[name].js';
          }
          if (chunkInfo.name === 'content') {
            return 'src/content/[name].js';
          }
          if (chunkInfo.name === 'popup') {
            return 'src/popup/[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
