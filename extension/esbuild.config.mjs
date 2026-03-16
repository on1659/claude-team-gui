import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: isWatch ? 'inline' : false,
  minify: !isWatch,
  target: 'node18',
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Extension host watching...');
} else {
  await esbuild.build(config);
  console.log('Extension host built.');
}
