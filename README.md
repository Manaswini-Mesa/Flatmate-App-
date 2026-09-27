# My Flattie (Pune)

Three roommates each fill in their own preferences, add flats manually, and see — for every flat — whether it
passes everyone's must-haves, a **match %** (sorted highest to lowest), and who is compromising on what. A flat reaches the
**agreed shortlist** only when all 3 roommates vote *shortlist* and every must-have passes for all three.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, email + password auth, Realtime) · Vercel.

## How it works

| Piece | Where |
|---|---|
| Database tables, access rules (RLS), group functions, realtime | `supabase/migrations/0001_init.sql`, `0002_more_details.sql` |
| Matching rules (pure functions) + tests | `src/lib/matching.ts`, `src/lib/matching.test.ts` |
| Loading group data + live updates | `src/lib/useGroupData.ts` |
| Screens | `src/app/` (dashboard, listing detail, join link, auth callback) |

**Matching rules**

- Budget: (rent + maintenance) ÷ 3 must be ≤ your max. Upfront: (deposit + brokerage) ÷ 3 ≤ your max, if set. Always must-haves.
- Areas you won't consider: always a must-have.
- Every other feature (size, lift, parking, security, power backup, AC, washing machine, balcony, flatmates allowed,
  non-veg cooking, guests, curfew, pets, move-in date) and every place you travel to can be *must have*,
  *nice to have (weight 1–5)*, or *don't care*. Lift only matters above the ground floor.
- Anything not known about a flat shows as **Needs checking** — never as a pass.
- **Match % per person** = points earned ÷ points possible. A must-have is worth 5 points, a nice-to-have its weight;
  only a pass earns points. **Match % per flat** = average of the roommates who have filled in preferences.
- The Flats dashboard is sorted from highest to lowest match %.
- Agreed shortlist: all 3 vote shortlist **and** every must-have passes for all three.

## Run it on your computer

1. Copy `.env.example` to `.env.local` and fill in the two Supabase values.
2. `npm install`
3. `npm run dev` → open http://localhost:3000
4. `npm test` runs the matching tests.

## One-time setup (Supabase + Vercel)

1. **Supabase** → new project → **SQL Editor** → run `supabase/migrations/0001_init.sql`, then `0002_more_details.sql`.
2. **Supabase** → Authentication → Sign In / Providers → turn **Confirm email** off (sign-in is email + password, no emails sent).
3. **Supabase** → Authentication → URL Configuration → Site URL = your Vercel URL.
4. **Vercel** → Project → Settings → Environment Variables → add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → redeploy.

Listings are entered by hand on purpose: property portals don't offer public APIs or permission to scrape.
