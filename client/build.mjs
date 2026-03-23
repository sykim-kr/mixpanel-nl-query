/**
 * Fallback build script using esbuild directly.
 * Used when `vite build` crashes due to rollup native binary incompatibility
 * with the current Node.js version on Windows (Node 24 + rollup 4.x MSVC binding).
 */
import * as esbuild from './node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'dist', 'assets');

// Ensure dist/assets exists
fs.mkdirSync(outDir, { recursive: true });

console.log('Building with esbuild...');

const result = await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: path.join(outDir, 'main.js'),
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  jsx: 'automatic',
  jsxImportSource: 'react',
  minify: true,
  sourcemap: false,
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
    'import.meta.env': JSON.stringify({ VITE_API_URL: process.env.VITE_API_URL || '' }),
  },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  logLevel: 'info',
});

if (result.errors.length > 0) {
  console.error('Build errors:', result.errors);
  process.exit(1);
}

// Copy static assets
const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

if (fs.existsSync(publicDir)) {
  for (const file of fs.readdirSync(publicDir)) {
    fs.copyFileSync(path.join(publicDir, file), path.join(distDir, file));
  }
}

// Write index.html
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace('/src/main.tsx', '/assets/main.js');
fs.writeFileSync(path.join(distDir, 'index.html'), html);

console.log('Build complete! Output in dist/');
