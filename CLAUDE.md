@AGENTS.md

# Gravv web redesign — project context

Redesign of the **Gravv** dashboard (Kredete's stablecoin payments platform: wallets,
transactions, payouts, payment links). Prototype only — all data is seeded placeholder data,
nothing persists. Owner: Folarin (product designer).

## Run it

- `npx next dev -p 4000` → http://localhost:4000
- **Stale CSS gotcha:** Turbopack often keeps serving an old `app/globals.css`. After editing it,
  check the served chunk (`curl` the page's `/_next/static/...css` and grep for the new token);
  if it's missing: stop the server, `rm -rf .next`, start again.
- Next 16 with `cacheComponents: true` → pages stay alive in the background (React `<Activity>`).
  Anything that should replay on every visit must reset in a `useLayoutEffect` cleanup
  (see `app/_components/roll.tsx`). Read `node_modules/next/dist/docs/` before Next-specific work.
- React Compiler lint forbids synchronous `setState` in effects — defer with `setTimeout`.
- Check: `npx tsc --noEmit && npm run lint`.

## How the owner works (important)

- **Confirm direction before big builds**, but don't bury them in option lists — they dislike being
  re-asked things they've already answered.
- Hates generic, "junior" dashboards and decoration: no decorative dots, toy device mockups,
  dot-grid canvases, chip soup, or colour without meaning.
- When a page should follow a product, look at the real screens first (Mobbin MCP is available),
  e.g. **Payment links = Mercury's Requests/Invoicing pattern**.
- Each page doesn't have to copy the others' layout — consistent tokens, different composition.
- Nour countdown (`app/_components/countdown`) stays unmounted unless explicitly asked for.

## Design system (keep consistent)

- Fonts: Geist + Geist Mono (local `geist` package). Dark first; light theme under
  `[data-theme="light"] .content-theme`. Theme switch (Light / Dark / System) in the sidebar footer.
- Weights: page titles and headline numbers are **font-medium**, never semibold.
- Colour: brand mint `--brand` / `--flow-in` means money in / good; grey `--flow-out` for out.
  Status chips: Completed/Active `--ok-bg`/`--ok-fg`, Pending/Paused dashed outline, Failed rose.
- Amounts: tabular nums, superscript cents; headline numbers roll in with `<Roll>`
  (`app/_components/roll.tsx`) on every page enter. Mark money with `.amount` so "Hide amounts"
  (top bar eye or ⇧H) can hide it — hidden figures are **pixelated** (8px mosaic via SVG filter `#gravv-pixelate` mounted in the top bar, applied in `globals.css`). Owner rejected blur and redaction bars.
- Shared parts: `Dropdown` (`app/_components/dropdown.tsx`), `CopyButton`, `Roll`,
  `TopBar` (search · "Updated n min ago" (click = refresh) · **Move money ▾** menu (Send money / Request payment / Convert currency) · │ · hide amounts (eye, ⇧H) · settings · bell),
  sidebar with Hugeicons stroke icons.
- Sheets/flows with typed input must not lose it to a stray click: once dirty, scrim click / Esc / × ask "Discard …? [Keep editing] [Discard]" (Esc = keep). Use `useDiscardGuard` + `DiscardConfirm` (`app/_components/discard-guard.tsx`); `[data-keeps-clean]` excludes controls, `clear()` on success. Every create/send flow has it.
- Tables: hairline rows, row click expands an inline preview, "View all details" opens a right sheet;
  bulk selection uses a black floating bar; ⋮ row menus.

## Pages

| Page | State |
|---|---|
| Transactions | Done — summary, To/From/Type/Channel/Customer/In & out chart dropdown, categories, ID-first table, inline preview + sheet |
| Wallets | Done — three facts, money-movement chart, table, inline panel, freeze/bulk |
| Recipients | Done — panels (Paid out / Corridors / Needs attention), table, send-money flow |
| Cards | Done (earlier pass) + **first-run onboarding** (`cards/_components/cards-onboarding.tsx`, after Mercury Books sign-up; particles in `cards/_lib/particles.ts`, card = **dots only**, sampled from Figma "Aurora — Front" (Gravv Branding, node 250:4716 → `public/cards/aurora-front.png`), floating large on the left in perspective. Owner rejected a three.js 3D card and any halo/glow — never turn the dots into a solid card). **Gravv cards are issued only through the API** — the dashboard requests card issuing, it never creates cards (header has "API keys", no "Issue card"). Flow: new account (no `gravv-cards-onboarded`) → sidebar out, dark starfield with occasional shooting stars + "Welcome to Gravv Cards" (centred at 45% width) → Issue cards: stars swirl into the dotted card, upright in the centre → it glides up into a slot directly above the centred form, fully lit (stacked on the centre line). Owner rejected side placements as "hanging" and a dim laid-back backdrop as "invisible" → Request access: one soft left→right scan across the card → granted: one slow ripple + slight warm-up (owner rejected the implode/shockwave as "too much"; keep it subtle and mature) → Go to Cards: card bursts into the empty page (in-out with outward bulge; owner rejected a plain ease-out), sidebar back → "Waiting for your first card" (curl `POST /v1/cards`, listening for `card.created`, Send a test card; auto-arrives after 6s) → first row lands. "Skip for now" → "Card issuing isn't on yet". "Replay intro" resets. Always dark until the reveal. **Sound**: Web Audio synth in `cards/_lib/onboarding-sound.ts` (pad, gather whoosh, lay-back swell, soft scan, granted chime + glints, meteor glides, burst whoosh); "Sound on/off" toggle top-right, saved in `gravv-onboarding-muted` |
| Payment links | Done — Mercury-style: 3 summary cards, Filters/Status, plain table, docked right panel (timeline, Copy/Open checkout/Edit/More, details, link + QR, note), full-screen 3-step create flow ("Optimal" design, the only one kept). Payer checkout at `/pay/[id]` (outside the dashboard, always light, branded from checkout settings): card (4242 ok / 4000…0002 declines), bank details, USDC by network + QR, receipt, paused/expired/sold-out pages, bottom-left prototype state control. **Edit** reuses the create sheet pre-filled (`editing` prop), opens on the review ("Edit link", Save changes disabled until something changes, "You're changing the …"); once anyone has paid, customer + amount/currency are Locked (duplicate to change); saving logs "Edited by …" in the link page timeline; a new pay-by date revives an expired link. Links live in a session store (`payment-links/_store.ts`, `useLinks`) shared by the list and `/payment-links/[id]`, so created/duplicated/edited links open on their page. Archive/Duplicate on the link page are still toasts. Owner rejected two earlier versions (our table template; a cards + phone-preview "workbench") as junior. |
| Accounts | Done — balance panel with trend + daily change, editable currency set (max 4, opens account flow if none), Open account flow, details sheet |
| Roles & permissions | Done — Revolut/Mercury-style: role list with faces, areas with access level + per-ability toggles, money caps, default roles locked (duplicate to edit) |
| Team | Done — members table (inline role, send cap, two-step), member sheet, invites, invite flow |
| Approvals | Done — queue (mine / others / history), request sheet with sign-off, rules as sentences + always-on settings |
| Configure | Done — integration home (no tabs): 24h health facts, go-live checklist (sandbox), key cards with usage + last IP vs allowlist, endpoint cards with delivery strip + outage actions, allowlist + connected apps (Mercury-style) side column, API request log with plain-words errors. Owner rejected tables-in-tabs and a node-map webhooks view. |
| Trade desk | Done — **Ticket first** layout (Binance OTC pattern; owner picked it over a Desk + ticket rail, which was removed) — OTC desk (request for quote). Two-step gate is a full-page inline set-up (QR + key, 6-digit code) replacing Gravv's modal-over-empty-page; "Show two-step gate" re-locks it (`gravv-trade-2fa`). Shared `QuoteTicket`: indicative rate → Get quote → firm rate held 30s → Accept → confirm with 2-step code → order placed (Awaiting funds → Settling → Settled live). Live-drifting rates board (click to quote a pair), activity split like Gravv's real desk: underline tabs **Requests** (every quote/RFQ: ID + copy, pair, amount, quoted rate, live "time left" countdown, status Live / Expired / Declined / the order's status + ID) · **Open orders** · **Order history**, with search + All pairs + status chip filters; orders tables keep inline progress + sheet. The ticket reports each quote's lifecycle (issued → expired / declined / accepted→order). **Settlement accounts (SSIs)** — Gravv's "Configure": header button opens a right sheet grouped by currency (bank: bank · number · name · country; wallet: network · address), one Default per currency, ⋮ Make default / Edit / Remove (removal archives so past orders still resolve), add/edit form switches bank vs wallet with per-network address checks (`settlement-sheet.tsx`). The ticket's "to …" in You get is a picker of that currency's accounts (default first, "Add an account…"); no account → "Add a {CCY} settlement account" and Get quote is blocked. **Funding + approvals:** You sell has a "from …" source picker (Gravv wallets/accounts with balances, or "outside Gravv"). Gravv sources are debited on place → straight to Settling; outside → Awaiting funds with deposit instructions on the order (exact amount, network/method, address/account, reference = order ID, 2h deadline, copy buttons, "I've sent it"). Orders over $500k (USD-eq) show an Approval row in the ticket and become **Awaiting approval** (Chioma Eze or Folarin Folarin, rate held 15 min, "Open in Approvals"); seeded OTC-2292 is also in Manage › Approvals ("Waiting on others"). New large orders auto-approve after ~9s in the prototype. **Order actions + problems** (`order-extras.tsx`): ⋮ on every order (View details · Copy payout details · Download confirmation when settled · Request again on cancelled/rejected · Cancel order… with inline confirm while awaiting approval/funds) and on requests (View order · Request again on expired/declined → refills the ticket · Copy request ID). Problem statuses in rose with plain explanation + next step in the preview: **Payout returned** (retry / pick another account), **Short deposit** (send the rest / settle what arrived), **Rejected** (approver note, request again), cancelled for no deposit in 2h. Ticket problems: route paused ("couldn't price this"), price moved before confirm ("Accept new price"). Header **State** dropdown (prototype): Filled / Empty (new account, designed empty tables) / Errors (seeds the problem orders, ticket refuses GHS + reprices once) / Loading (skeletons). **Over the daily limit:** the ticket swaps Get quote for "This is bigger than today's limit" → **Ask the desk** (timing Now / Within the hour / By end of day + note → request "With the desk · Adaeze Okoro" → trader's firm quote held 5 min, accept as usual) or **Request a higher limit** ($5M/$10M/$25M + reason → "Left today" notes the pending increase). **Export** in the activity toolbar downloads a CSV of the current tab with filters applied. Assets carry marks (`asset-mark.tsx`): round emoji flags for fiat, USDC/USDT coin logos; `Dropdown` options take an optional `icon`. Sparklines + 24h change coloured by direction (green up / red down / grey flat). Facts strip on top; `RateChart` for the ticket's pair (24H/7D/30D, line coloured by the move, hover puts the rate + time in the header). Uses the app's chart pattern (range switch + bordered "Hide chart" pill, like Wallets/Transactions), **no panel background** (owner rejected it). **Placement chosen: in the rates list** — opens inline under the picked rate (other placements + the Chart dropdown removed). Starts closed; opens by itself once you start a quote (type an amount / change currency) and stays open until you hide it ("Hide chart" or click the row); after hiding, typing leaves it closed, picking a rate reopens it |
| Collections | Done — from Gravv's real screen (Card Collection › Collections): card payments settle to you in USDC, two stages can fail (card charge, then settlement) with Gravv's status words (Settlement completed / pending / failed, Payment failed, Expired, Abandoned, + Refunded / Partially refunded). Three facts (Settled 30d with fees, Paid through % with the biggest loss in words + Show, Charged-not-settled with Retry all). Tabs by outcome, date range, search by Payment ID / Reference / Customer, Export. Table: date+local time, payment ID + source (link name / API) + reference, customer + card brand ••last4 + flag, USDC subtotal + amount charged, status chip, Checks (Protection + 3-D Secure). Row preview = the payment's path in words (Checkout → Protection → 3-D Secure → Card charge → Settlement, failing step in rose) + plain reason + Retry settlement / Refund. Sheet: money breakdown (fee 2.9% + 0.30), checks, card, customer, timeline, IDs, settlement hash. Refund dialog (full/partial, reason, note, discard guard). Bulk: black floating bar (Retry settlement, Export). Disputed payments link to Disputes (still a placeholder). |
| Overview | Empty — planned as Mercury-Insights-style (net cashflow, written insights, monthly in/out bars + net line, timeline scrubber) |
| Everything else | Placeholder: animated 3D pixel crane (`app/_components/in-the-works/`) + "{Page} is still in the works" |

Earlier versions worth keeping are copied into the session scratchpad, not the repo.
