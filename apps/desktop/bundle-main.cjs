const path = require('node:path');
const esbuildPath = require.resolve('esbuild', {
  paths: [require.resolve('vite')],
});
const esbuild = require(esbuildPath);

async function build() {
  // 1. Empaquetar el proceso principal (Main Process) en un único archivo CommonJS autocontenido
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/main/index.ts')],
    outfile: path.resolve(__dirname, 'dist/main/index.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    external: ['electron', 'better-sqlite3', 'ffprobe-static'],
  });

  // 2. Empaquetar el script de precarga (Preload) en un único archivo CommonJS autocontenido para sandbox: true
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/preload/operator.ts')],
    outfile: path.resolve(__dirname, 'dist/preload/operator.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    external: ['electron'],
  });

  console.log('[esbuild] Proceso principal (dist/main/index.js) y preload (dist/preload/operator.js) empaquetados correctamente.');
}

build().catch((err) => {
  console.error('Error empaquetando main/preload con esbuild:', err);
  process.exit(1);
});
