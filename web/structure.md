# Project Layout (LOCKED)

- Next.js with `src/` layout. Alias: `@/*` → `./src/*`.
- UI lives under `src/app/**` (e.g. `page.tsx`, `layout.tsx`, client components).
- Backend endpoints under `src/app/api/**/route.ts` only.
- No UI files inside `src/app/api/**`.

## Paths
- Dashboards: `src/app/(dash)/{admin,carrier,customer}/page.tsx`
- Login: `src/app/login/page.tsx`
- API:
  - `src/app/api/auth/{login,logout,register,me}/route.ts`
  - `src/app/api/{bids,tasks,carrier}/route.ts`
  - `src/app/api/dev/seed-min/route.ts`
- Lib: `src/lib/{db.ts,auth.ts}`
- Prisma: `prisma/{schema.prisma,dev.db}`

## Invariants
- No duplicate routes for the same URL (e.g. `/admin` only under `(dash)`).
- No `.tsx`/`.jsx` under `src/app/api/**`.
- `tsconfig.json` must have `"baseUrl": "."` and `"@/*": ["./src/*"]`.
- `/api/carrier` is **singular** path.

This contract is enforced by `scripts/guard-structure.mjs`.
