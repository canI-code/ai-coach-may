import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Vitest configuration for the Interview Module.
//
// Conventions (see .kiro/specs/interview-module/design.md - Testing Strategy):
// - Single-run execution is driven by the `test` script (`vitest run`, no watch).
// - Property tests live under `src/lib/interview/__tests__/properties/*.property.test.ts`
//   and integration tests under `src/lib/interview/__tests__/integration/*.integration.test.ts`.
// - Pure logic + Next.js route handlers run under the Node environment; browser
//   modules (`browser/*.ts`) are exercised as pure functions over synthetic inputs,
//   so no DOM/MediaPipe runtime is required.
// - The legacy ad-hoc scripts under `src/scripts/tests` execute on import and are
//   deliberately excluded; Vitest replaces them as the runner.
export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig path alias: `@/*` -> `./src/*`.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/interview/**/*.test.ts', 'src/lib/dashboard-suite/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next', 'skills', 'src/scripts/**'],
    // The foundation scaffold has no test files yet; later tasks add them.
    passWithNoTests: true,
  },
});
