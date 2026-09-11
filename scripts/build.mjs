/**
 * 构建两半：
 *  - host: lib/index.js —— ESM，@deepseek-ai/* 外部化（由 DSH 宿主组合解析）
 *  - client: lib/client.js —— CJS 闭包工厂 bundle，window.__ModuleLoader__.load
 *    交接，externals 走 loader 模块表（官方 harness preset 同款）
 */
import { build } from 'esbuild'

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-ui-slots',
  // web 引导的静态模块表成员：运行时 require 解析（官方图标原语）
  '@deepseek-ai/dsh-client-ui-primitives',
]

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'lib/index.js',
  external: ['@deepseek-ai/*'],
  jsx: 'automatic',
  sourcemap: false,
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  outfile: 'lib/client.js',
  external: CLIENT_EXTERNALS,
  jsx: 'automatic',
  sourcemap: true,
  banner: {
    js: [
      'window.__ModuleLoader__.load({ id: "dsh-multi-tenant", factory: (require) => {',
      'var module = { exports: {} };',
      'var exports = module.exports;',
      'Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    ].join('\n'),
  },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
})

console.log('build ok: lib/index.js + lib/client.js')
