/**
 * Server startup hook — P9.5.5.2 (Localization Runtime Recovery, part 2)
 *
 * Next.js calls `register()` exactly once, when the server process boots,
 * before it accepts any request. That is the one point in the whole
 * request lifecycle guaranteed to run before `src/app/layout.tsx` — the
 * root layout every route renders — which calls `getDirection()` (via
 * `@/i18n/runtime`) and, as of P9.5.5.1, reliably resolves a `@/config`
 * field on literally the first render of any page.
 *
 * Platform Administration modules (`@/platform-admin`) only ever register
 * when a `/platform-admin/*` page's own module runs — a *child* of the
 * root layout in the React Server Component tree, so it can never execute
 * before the layout does. Once the layout seals the registry (P9.0's
 * by-design "first read seals" rule — see `src/config/registry.ts`), any
 * later `registerAdminModule()` call throws `register(...) called after
 * the registry was sealed`, no matter how correctly `platform-admin/`'s
 * own files order their imports (P9.5.5.1 already fixed that half).
 *
 * The only way to guarantee registration happens before ANY reader is to
 * do it before the server starts serving requests at all — hence this
 * hook, not a change to `platform-admin/` or `i18n/runtime.ts` again.
 * See docs/P9.5.5.2_STARTUP_REGISTRATION.md.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/config')
    await import('@/platform-admin')
  }
}
