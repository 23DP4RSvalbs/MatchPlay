# MatchPlay

Sports venues, team lobbies and live scores. Work is on `Roberts`.

## Run locally

Node 22.12 or newer. From the repository root:

```sh
npm ci
npm run db:seed
npm run dev
```

Open http://localhost:5173. The API runs on port 3001. SQLite data stays in `data/`.
Seeding is optional and preserves existing games. Migrations run when the API starts.
Copy `.env.example` to `.env` if you need different ports or an application URL.

## Demo accounts

Password: `MatchPlay2026!`. The sign in page also has demo buttons.

| Email                   | Use                                      |
| ----------------------- | ---------------------------------------- |
| roberts@matchplay.local | Player with sample history               |
| janis@matchplay.local   | Organiser of the sample basketball games |
| captain@matchplay.local | Blue captain in those games              |
| admin@matchplay.local   | Venue and user management                |

Create a game, share its code, join a team, then assign captains. The organiser
starts and finishes the game and controls the clock. Captains add points to their
own team. Finished scores are locked and saved to history.
The sample live game starts with its clock paused. Janis can resume it.
Choose a sport before picking a venue. The form shows compatible courts and fills
in the usual team size; you can change that size before creating the game.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run build
```

Browser tests use a separate temporary database on ports 5174 and 3002. If Chromium
is missing, run `npx playwright install chromium` first.

## Code

`apps/web`: React, Vite, Tailwind, Query and MapLibre. Screens and shared components
are separate. Palette values are in `src/styles.css`.
Motion lives in `src/motion.css` and `src/lib/useReveals.ts`. Cards enter once as
they come into view. Animations respect the device's reduced motion setting.

`apps/api`: Fastify, Better Auth, Drizzle and SQLite. The server checks team capacity,
roles and scoring rules. WebSocket events refresh game rooms and public previews.

`packages/shared`: request validation, common types and tennis scoring.

The web build is in `apps/web/dist`; the API build runs with
`npm run start -w @matchplay/api`. A hosted web server must proxy `/api` and WebSockets
to the API. Set `APP_URL` and `BETTER_AUTH_SECRET` before hosting. Seeded accounts are
for local demos.

## Assets

The map needs internet access. Its dark style adapts
[OpenFreeMap Liberty](https://github.com/hyperknot/openfreemap-styles), with
OpenStreetMap and OpenMapTiles attribution kept on the map.

Venue photos are generated illustrations, labelled in venue details. Ratings and
history in the seed are sample data. Coordinates come from OpenStreetMap; sports
availability is demo data.

Useful docs: [React](https://react.dev/learn),
[Tailwind](https://tailwindcss.com/docs),
[MapLibre](https://maplibre.org/maplibre-gl-js/docs/),
[Fastify](https://fastify.dev/docs/latest/),
[Better Auth](https://www.better-auth.com/docs),
[Drizzle](https://orm.drizzle.team/docs/overview),
[browser animation performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS#handling_animations).
