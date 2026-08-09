# Trading Journal

## What it is

A record of **decisions**, kept deliberately separate from **outcomes**.

The distinction is the whole point. A trade that loses money after following the plan
is the cost of doing business. A trade that makes money after breaking the plan is luck
that will eventually bill you. A journal that only tracks P/L cannot tell these apart,
so this one tracks both and reports them separately.

## Status

| Piece | State |
|---|---|
| Data model, service, REST API | Built |
| Web UI (list, entry form, stats) | Built |
| Seeded from the trading handoff (5 trades) | Built |
| AI review layer | Not started |
| Risk calculator | Not started |
| Open-positions tracker with live P/L | Blocked on US price source |
| Mobile app | Not started |

## Design rules

**1. The journal never re-stores what the ledger already knows.**
For trades booked through this app's portfolio, P/L comes from the transaction ledger and
its calculators. The journal adds only what the ledger cannot know — why you entered, what
your stop was, whether you actually placed it, how you felt, what you learned.

Trades from an outside broker (Robinhood, a PSX broker) carry their own entry/exit prices
because there is no ledger behind them. That is the only case where prices live here.

**2. Nothing computed is stored.**
`grossPnL`, `netPnL`, `pnlPct`, `rMultiple`, `outcome`, `riskAmount` and `followedPlan` are
derived on read in `journalService.computeMetrics`. An edited entry can never disagree with
its own statistics.

**3. Uncertainty is recorded, not laundered.**
`exitConfirmed: false` means the price came from memory rather than a broker fill.
`datesEstimated: true` means the dates were reconstructed. Stats surface the count of
unconfirmed exits rather than silently averaging them in. This exists because a remembered
"−25%" on INTC turned out to be wrong — the system must not repeat that mistake with a
confident-looking number.

**4. Currencies are never summed.**
Stats are grouped per currency (`byCurrency`). Adding a PKR result to a USD result produces
a number that means nothing. Process metrics are currency-free and reported once.

## Model

`backend/src/models/JournalEntry.js`

| Group | Fields |
|---|---|
| Identity | `user`, `portfolioId?`, `symbol`, `exchange`, `currency`, `direction`, `setupType` |
| Entry | `entryDate`, `entryPrice`, `quantity` |
| Exit | `exitPrice?`, `exitDate?`, `exitConfirmed`, `fees` |
| Open mark | `markPrice?` — hand-entered last price, kept out of realized totals |
| The plan | `plannedStop?`, `plannedTarget?`, `stopPlaced`, `eventChecked` |
| Review | `emotionalState`, `marketCondition`, `mistakes[]`, `tags[]`, `notes`, `lesson` |
| Provenance | `datesEstimated`, `reviewedAt` |

`status` is derived: a trade is closed once it has an `exitPrice`. An exit date is optional,
because trades reconstructed from statements often have a known result and an unknown date.

`stopPlaced` is the field that matters most. A stop you intended is not a stop; only a
resting order at the broker is. The model rejects `stopPlaced` without a `plannedStop`.

### Mistakes

`no_stop_placed`, `held_through_event`, `no_profit_protection`, `moved_stop_down`,
`oversized`, `fomo_entry`, `no_thesis`, `exited_early`

An empty list means the plan was followed. Losses are expected to have an empty list often.

## API

```
GET    /api/journal              list (filters: symbol, exchange, setupType, status, outcome, from, to)
POST   /api/journal              create
GET    /api/journal/:id          single entry
PUT    /api/journal/:id          update
DELETE /api/journal/:id          delete
GET    /api/journal/stats        derived statistics
GET    /api/journal/options      enum vocabulary, so the UI never hardcodes a drifting list
```

### Stats shape

`byCurrency[]` — win rate, net P/L, profit factor, average R, expectancy, best/worst trade,
streaks, breakdowns by setup and emotion.

`process` — currency-free discipline metrics:

- `stopPlacedRate`, `eventCheckedRate`, `followedPlanRate`
- `goodProcessBadOutcome` — followed the plan and lost. Not a mistake.
- `badProcessGoodOutcome` — broke the plan and won. Luck, and a warning.
- `unconfirmedExits` — how much of the above rests on memory
- `byMistake` — each failure mode with its count and what it cost, worst first

## Seed data

`node src/scripts/seedJournal.js <userEmail>` **replaces** the journal with the seven
reviewed trades — three UPS lots, SMCI, DXCM, INTC and the open MAS position. It replaces
rather than merges because every figure is confirmed, and merging would leave older
estimates behind.

The record makes the point on its own: 4 wins against 2 losses, a 67% win rate, and the
account still down. INTC alone — the one closed trade with no resting stop — cost $70.77,
while every other closed trade combined made +$62.84. Losses average roughly twice the
size of wins, which is what an unstopped loss does to an otherwise decent hit rate.

Only 1 of the 7 trades had a stop actually resting at the broker.

## What's next

**AI review layer.** The split matters: code computes every number, the model only interprets
them. The AI is given the structured stats plus the free-text notes and asked what pattern it
sees — never asked to do arithmetic, which it does unreliably. Target: a monthly review that
names the recurring failure and what it cost.

**Risk calculator.** Given capital and risk tolerance, size the position. Feeds `plannedStop`
and `quantity` directly into a new entry.

**Open-positions tracker.** Needs a live price source per exchange. PSX has one; US does not
yet, so a US open position cannot show live P/L. Closed-trade journaling works for both
markets today because it needs no price feed.

**Mobile.** The API is already JWT/REST and mobile-ready. The realistic path is Capacitor
wrapping the existing React app, which requires the screens to work at phone width first.
