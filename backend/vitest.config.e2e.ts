import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

// esbuild no emite `design:paramtypes`; sin metadata el DI por clase de Nest
// no resuelve. SWC sí la emite (decoratorMetadata).
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          useDefineForClassFields: false,
        },
        target: 'es2022',
      },
      module: { type: 'es6' },
      sourceMaps: true,
    }),
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
