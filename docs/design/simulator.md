# Design: simulator

Status: **draft** (2026-11-10). Nothing in here is built yet. Every number marked _(proposal)_ needs the
owner's OK. Balance numbers stay in `src/game/balance.ts`; the simulator never owns a copy of them.

**Goal (owner, 2026-11-10):** a simulator that shows how a player progresses, with graphs for different
settings. It unblocks slowing progress down, item defence, ascend speed, the mana/skills numbers and the speed
upgrade (see [BACKLOG.md → Progression & balance](../BACKLOG.md#progression--balance) and
[PLAN.md → Pacing](../PLAN.md#pacing-to-do)).

One sentence version: **run the game's own tick loop thousands of times faster than real time, with a bot
instead of a player, and draw what happened.**

---

## 1. Research: how idle-game balance is simulated and plotted

Short and practical. What we take from each source is in the bullets.

### 1.1 The Math of Idle Games (Anthony Pecorella, Kongregate)

Three articles, the standard reference for this genre
([Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i),
[Part II](https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii),
[Part III: prestige](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii);
slides: [Quest for Progress, GDC Europe 2016](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)).

- Costs grow exponentially, `cost = base × r^owned`, production grows only linearly or polynomially, so the
  player is ahead early and falls behind later. Resets (prestige) restart the curve higher. This is the shape
  our game has too (`1.15^level` upgrades against `1.28^L` mob HP).
- Bulk buy has a closed form: `base × r^k × (r^n − 1) / (r − 1)`. We already use it (`bulkQuote` in
  `balance.ts`).
- **Estimate progression by simulating a buyer**: at every opportunity buy the item with the best
  income-to-cost ratio, and plot income and cost over time on a **log scale**. The article calls this an
  approximation of real play (real players buy in bulk and not optimally), good for the ballpark.
- Checks the article suggests: does the newest generator always dominate (then older ones are irrelevant)?
  Are there visible spikes where multipliers kick in? Where does the wait for the next purchase become
  prohibitive?
- Prestige (Part III): reward formulas are sqrt/cbrt-like in total earnings (AdVenture Capitalist
  `150·√(lifetime/10^15)`, Cookie Clicker cube root, Realm Grinder from max earnings). The main chart is the
  gain against the multiple of the previous run's earnings, with the point where the gain doubles marked.
  Players are modelled by **varying the reset target within a reasonable range**.
- **We take:** a greedy "best payback" buyer as the reference bot; log-scale income and cost; time between
  purchases as a pacing chart; ascend timing as a swept bot parameter.

### 1.2 Player personas and Monte Carlo (Machinations)

[Machinations](https://machinations.io/articles/balancing-f2p-economies-simulating-player-personas-and-progression-curves-with-machinations)
([intro](https://machinations.io/articles/what-are-game-simulations-and-why-should-you-care)) is a vendor
tool, so treat the numbers as illustrative, but the method is general.

- A **persona is a parameter set** (play hours, spend chance per step, ad-watch rate), run many times with
  different random seeds (their example: 100 simulated players, 1 step = 1 game minute).
- Report **distributions** (p2 / p50 / p98), not only the mean, and compare personas at **fixed time
  horizons** ("progress after 2 h") instead of only at the end.
- Set an explicit target gap between personas and check it against the distribution.
- **We take:** bots are small parameter sets; Monte Carlo over seeds (drops and crits are random); report
  median with a p10–p90 band; compare bots at fixed horizons (10 min, 1 h, 8 h, 24 h).

### 1.3 Headless runs of the real engine, bots, sweeps

- Run the **real game logic headless** with AI playstyles and flag unhealthy metrics. One indie write-up ran
  1,000,000 games in about two minutes
  ([drugwarz dev log](https://drugwarz.pages.dev/blog/v0-4-data-driven-balance), an anecdote, but it shows the
  approach is cheap). Unity's Game Simulation did the same with bots at scale
  ([Furyion case study](https://unity.com/case-study/death-carnival)).
- **Parameter sweep** = run the same bot over a grid of one or two settings and compare one outcome (time to
  stage N). **Sensitivity analysis** = which setting moves that outcome most; do one setting at a time around
  the current value first (±25 %, ±50 %), then 2-D grids for the few that matter.
- Few runs near a threshold give unstable answers: use more seeds exactly where two variants are close.
- **We take:** the sim is the real `update()`, never a re-implementation; sweeps are a cross product of a few
  settings; the output is "time to stage N" with an uncertainty band.

### 1.4 Prestige timing (when is the best moment to ascend)

- The useful quantity is **payback time**: how long until the reset path catches up with the keep-going path.
  A generic calculator uses payback as a share of the planning horizon (under 25 % reset now, over 60 %
  wait; [west-games calculator](https://west-games.com/idle-game-prestige-timing-calculator/), a thin SEO page
  but the model is sound). Pecorella's Part III gives the reward-formula side.
- In a simulator the cleanest method is not a formula: **sweep the ascend threshold** (ascend at stage level
  N) and plot "progress after 24 h" against N. The best moment is the peak of that curve. It also needs no
  assumption about how the bonus works.
- **We take:** an `ascend.atLevel` bot parameter and a "best ascend moment" chart (section 5.3).

### 1.5 What to plot (collected)

Progress (stage) over time, log time axis · time to reach stage N per setting, with a band · income and
cost over time (log) · time between purchases · DPS against mob HP, or time-to-kill against time-to-die
(shows the wall) · time spent per stage · prestige gain against run length · distribution across seeds. The
report in section 5 is built from exactly this list.

---

## 2. Architecture

### 2.1 Principle

```
 scenario JSON ──► sim runner ──► the game's own update()/actions  ──► samples, milestones, purchases
 (seed, bot,         (src/sim)       (src/game/*, unchanged logic)        │
  tuning, sweep)          ▲                                               ▼
                          └── bot = small policy functions         CSV / JSON / HTML report / debug tab
```

- The runner owns a `GameState` and calls the same pure functions the UI calls: `update(state, dt)`, and the
  actions `buyUpgrades`, `buyWeapon`, `buyCompanion`, `equipItem`, `switchStage`, `setAutoAdvance`,
  `companionClick`, `ascend`. It never edits state fields itself.
- Time is the tick counter. One tick = 1/60 s. There is no wall clock inside `src/game/`, so "faster than
  real time" is just calling `update()` in a loop.
- A bot only gets what a human has: the public state and the pure actions. If a human can't do it from the
  UI, the bot can't either. That keeps results honest.
- The analytic helpers bots use to decide (effective DPS, time to kill, time to die) are **approximations for
  decisions only**. Outcomes always come from the real tick.

### 2.2 What is already pure, and what needs a seam

Read through `src/game/` on `staging` (2026-11-10).

| Thing | State today | Needed |
| --- | --- | --- |
| `update`, all actions, `createState` | Pure, return new state. `update(state, dt)` runs `round(dt × 60)` ticks (min 1) in one copy. | Nothing. |
| Clock | No clock in `src/game/`. Time is `state.ticks`. Real time exists only in `src/loop.ts` and `src/game.ts`. | Nothing. (`state.ts` imports `TICK_RATE` from `src/loop.ts`; safe in Node because `loop.ts` touches `requestAnimationFrame` only inside methods. Optional tidy: move the constants to `src/game/time.ts`.) |
| Drop RNG | Seeded: `Gear.rng` (mulberry32, one uint32), advances on every kill. | Seed must be settable. |
| Crit RNG | `critRng`, derived from the drop seed in `createState`. | Nothing: **one seed reproduces the whole run**. |
| Default seed | `newProgress()` → `newGear()` → `randomSeed()` → `Math.random()`. | **Seam 1:** `newProgress(seed?: number)` passes the seed to `newGear`. Default behaviour unchanged. |
| Click input | `companionClick(state)`: pure, cooldown is counted in ticks (crow 0.5 s, so at most 2 pecks/s). | Nothing. A bot clicks between `update` calls. (Mana from clicks lives on the unmerged `code/mana-bar` branch; it comes for free once merged, because the bot calls the same function.) |
| Player choices | Equip, sell, stage switch, auto-advance, buy: all pure actions in `state.ts` / `items.ts`. | Nothing. |
| Events | `state.events` is a fresh list per `update` call (sfx, damage, coins, `item`). | Nothing: the runner reads `item` and `coins` events for drop and income stats. |
| Debug hook | `forcedDrop` is a **module-level** variable in `items.ts` (debugger only). | Sim never calls it. Note for parallel runs: use one worker per run (2.4), never several runs in one module instance with the debugger hook. |
| Balance numbers | `balance.ts` exports `const` values; mob HP/damage/coin parameters (`MOB_HP`, …) are private; `ITEMS` is a plain object; some values are **derived at import** (`ASCEND_COST`, `ASCEND_GATE_LEVEL`, `CRIT_MAX_LEVEL`). | **Seam 2:** a `TUNING` object that holds every tunable, with the derived values turned into functions (or recomputed on override). A sweep needs this. See 2.3. |
| "What can I buy?" | The list of purchasable things is built in the UI (`ui/menu.ts`). | **Seam 3:** a catalogue `purchaseOptions(state)` returning `{ target, cost, apply }`. Start in `src/sim/options.ts` (no game change). Promote it to `src/game/` and let the UI use it later, so a new feature adds one line and both the shop and the bots see it. |
| Effective DPS | `heroDps` ignores crit and companions; the stats window computes more. | A `power.ts` in `src/sim/` (or reuse the stats window formula once it is in `src/game/`): hero hit × crit × speed + companion DPS, and time-to-kill / time-to-die for a stage. |
| `Math.random` / `Date.now` / `performance.now` | Only in `randomSeed`, `Loop`, `game.ts`. | Seam 1 covers the only one that matters. |

Rule for the future: **a feature that adds a player action (mana skills, stage picks, speed upgrade) adds its
catalogue entry and a default bot policy in the same PR.** Otherwise the sim silently models a player who
can't use the feature. Right now: `code/stage-picks` (a choice that pauses the fight) and `code/ascend-speed`
are on branches and not on `staging`.

### 2.3 Tuning overrides (Seam 2)

Options considered:

1. Mutate the exported objects before a run. Works for `ITEMS` and `WEAPONS`, impossible for private
   constants and for derived-at-import values.
2. Pass a `Balance` object into every function. Cleanest, but touches every call in the game: too big.
3. **(Recommended)** One exported `TUNING` object (plain data, defaults identical to today). Functions read
   `TUNING.x` instead of a module constant. The simulator sets overrides **per worker thread** before the
   run (`applyTuning(dotted.path, value)`), so module state never leaks between runs.

Guard: a test that prints `mobHp / mobDamage / mobCoins / upgradeCost / weapon prices / item stats` for stage
levels 1–60 and compares them to a golden table made **before** the refactor, so the seam PR provably changes
no behaviour. This PR touches `balance.ts`, which every balance thread edits, so it goes in early and small.

### 2.4 Runner

```ts
// src/sim/run.ts   (pure TypeScript: no fs, no process, no DOM, so Node and the browser both import it)
runScenario(run: ResolvedRun): RunResult
```

```
state = createState(start)                  // new game, or a Progress from a save string
while (state.ticks < endTicks):
    state = bot.act(state, ctx)             // zero or more pure actions (buy, equip, click, …)
    n = min(bot.stepTicks, endTicks - state.ticks)
    state = update(state, n / 60)           // the real tick loop, n ticks in one call
    sampler.observe(state)                  // reads state.events, best, coins, deaths …
```

- `bot.stepTicks` is how often the bot wants to look: 60 for a buyer, 15 for a clicker, 36,000 (10 min)
  for a lazy checker. The runner never batches past it.
- **Speed measured on this machine** (stick-and-200-levels state, `update` alone, Node 26): one `update` per
  tick = 0.66 M ticks/s; batches of 15 ticks = 3.2 M ticks/s; batches of 60 = 4.0 M ticks/s. An 8 h run is
  1.73 M ticks, so about **0.5 s**. 24 h ≈ 1.5 s. A sweep of 5 variants × 20 seeds × 24 h ≈ 2.5 min on one
  core, well under a minute on 4 workers. No fast-forward tricks needed; do not build any until a profile
  says so.
- Batching changes nothing for outcomes: `update` loops `step` per tick either way (only the shop-reveal and
  max-DPS bookkeeping run once per call). A test proves a do-nothing bot ends in the same state with batch 1
  and batch 60.
- Death handling is part of the game: the hero dies, rolls back one stage and **auto-advance turns off**. An
  idle bot would then farm the same stage forever. This is a real behaviour of an AFK player, and the first
  thing the sim will show (section 3).

---

## 3. Player models (bots)

A bot is a **bundle of small policies**. Each policy is a function `(state, ctx) → state` that calls only pure
actions. A bot is declared in JSON by naming its policies and their parameters, so a new player model needs
no new code when the pieces exist.

```ts
type Policy = (s: GameState, ctx: BotCtx) => GameState;
type Bot = {
  id: string;
  stepTicks: number;        // how often the runner calls act()
  act: Policy;              // runs the policies below in order
};
// ctx: tick, seeded RNG for the bot's own choices, last-action log, scenario knobs
```

| Policy | Choices | Notes |
| --- | --- | --- |
| **buy** | `none` · `greedy-dps` · `cheap-first` · `weapon-first` · `random` | See below. |
| **equip** | `never` · `best` · `at-checkin` | Equip the item per slot that raises effective DPS or survival most. `never` = "drops don't exist" baseline, so item balance can be measured against it. |
| **sell** | `never` · `junk-at-checkin` | Sells bag items that are worse than the worn ones. Sell price is `5 × mobCoins × tierMult` (about 5 kills), so it's a small income. |
| **advance** | `game-default` · `margin(x)` · `farm(k)` | After a death auto-advance is off. `game-default` never turns it back on (the AFK worst case). `margin(x)` turns it on when predicted time-to-die ≥ x × time-to-kill at the next stage. `farm(k)` farms k kills before trying. |
| **click** | `none` · `rate(n)` | Calls `companionClick` n times per second (capped by the crow cooldown: `min(n, 2)`). Needs the crow bought. Mana is added by the same call once it lands. |
| **ascend** | `never` · `asap` · `atLevel(N)` · `payback(p)` | `asap` = as soon as `canAscend`. `payback` only makes sense once ascend gives a bonus. |
| **schedule** | `always` · `checkIn(every)` · `sessions(on, off)` | See below. |

### Buy policies

- **`greedy-dps`** (the reference, matches the owner's "best damage per coin"): each time the bot looks,
  list `purchaseOptions(state)`, apply each to a copy of the state, measure the gain in effective DPS, buy
  the highest `gain / cost` that is affordable; if nothing is affordable, wait. A survival gate: if the
  predicted time-to-die at the frontier stage is shorter than the time-to-kill, it values defence and max HP
  by `gain in time-to-die / cost` instead. Greedy one-step is the standard idle bot (section 1.1).
- **`cheap-first`**: always buys the cheapest affordable thing. Models a player who clicks every button as
  soon as it lights up. Usually worse than greedy: the gap between them is itself a balance signal.
- **`weapon-first`**: saves for the next weapon and ignores upgrades. Models "big purchases feel good".
- **`random`**: a random affordable purchase. A noise floor.

### Named bots to compare (the default set)

| Bot | buy | equip | click | advance | schedule | Stands for |
| --- | --- | --- | --- | --- | --- | --- |
| `idle` | none | never | none | game-default | always | Opens the page and walks away. Lower bound. |
| `idle-greedy` | greedy | best | none | margin(1.5) | always | Plays, never clicks. |
| `active` | greedy | best | rate(2) | margin(1.5) | always | The engaged player: clicks, crow, mana. Upper reference. |
| `cheap-first` | cheap-first | best | none | margin(1.5) | always | Buys everything lit. |
| `no-gear` | greedy | never | none | margin(1.5) | always | Item balance baseline (drops vs no drops). |
| `lazy-10m` / `lazy-1h` / `lazy-8h` | greedy | at-checkin | none | margin(1.5) | checkIn(10 min / 1 h / 8 h) | Game open in a tab, player looks in now and then. |

### Gaps, the lazy player, and offline progress

The game has **no offline progress** (PLAN → Runtime: it pauses when the tab is hidden or off-screen). So
there are two different kinds of "gap", and the sim models both:

1. **Inattention** (`checkIn(every)`): the tab stays open and the game runs, but the player only acts every
   10 min / 1 h / 8 h. Between check-ins the bot does nothing. This is where a death hurts: the hero rolls
   back, auto-advance is off, and he farms the old stage until the next check-in. `lazy-8h` shows exactly how
   much an overnight AFK costs.
2. **Closed tab** (`sessions(on, off)`): the game does not advance at all during `off`. Game time only
   counts the `on` parts, but the report can put either **play time** or **wall-clock time** on the x axis
   (wall time = play time + gaps). The config has `offline.rate` (default 0: today's rule) so that if offline
   progress is ever added, it can be switched on and compared without new code.

---

## 4. Scenarios and settings

A scenario is a JSON file. It names the bots, the tuning overrides, the sweep and the seed. Same file, same
seed, same output (byte for byte; the version of the game is in the output).

```jsonc
{
  "name": "drop-chance-sweep",
  "seed": 1,                         // seeds used: seed, seed+1, … (Monte Carlo)
  "runs": 20,                        // seeds per variant
  "duration": "24h",                 // simulated PLAY time
  "start": "new",                    // or { "save": "path/to/save.txt" }, or a Progress object
  "bot": "active",                   // a named bot, or an inline { buy, equip, click, … } object
  "tuning": {                        // fixed overrides for every variant
    "mob.hp.growth": 1.28
  },
  "sweep": {                         // cross product; the cli refuses > 200 variants unless --force
    "items.dropChance.mob": [0.0025, 0.005, 0.01, 0.02]
  },
  "compare": {                       // or: named variants side by side
    "bot": ["idle", "idle-greedy", "active", "lazy-1h"]
  },
  "sample": "60s",                   // sample spacing in play time (max 1,500 samples per run)
  "report": {
    "xAxis": "log",                  // "log" | "linear"; "time": "play" | "wall"
    "targets": [{ "level": 7, "label": "World 2", "at": "5m" }]
  }
}
```

### Settings that can be varied (sweeps)

Tuning keys are dotted paths into `TUNING` (Seam 2) and keep today's defaults. Bot knobs are plain fields.

| What the owner wants to vary | Key | Today |
| --- | --- | --- |
| Drop chance | `items.dropChance.mob` / `.boss`, `items.earlyDrop.*` | 0.5 % / 3 %, early 4 % |
| Item find | `items.stats.itemFind.base`, `items.caps.itemFind`, `items.rarity.*` | 5 % per roll, cap 100 % |
| Mob HP growth | `mob.hp.growth` (and `.base`, `.boss`, `world1.hpMult`) | 1.28 |
| Mob damage growth | `mob.dmg.growth` | 1.07 |
| Coin growth | `mob.coins.growth` | 1.30 |
| Upgrade growth | `upgrade.growth` | 1.15 |
| Weapon price steps | `weapons[i].price`, `weapons[i].upgradeBase` | ×30 steps |
| Item defence | `items.stats.defence.base`, `character.defence.*` | 0.3 base |
| Crit | `crit.maxChance`, `crit.damageMult`, `character.crit.*` | 75 % cap, ×2 |
| Ascend gate and price | `ascend.gate`, `ascend.costKills` | 6.1, 100 kills |
| **Ascend timing** (bot) | `bot.ascend.atLevel` | n/a |
| **Click rate** (bot) | `bot.click.rate` | 0–2 per s |
| **Check-in interval** (bot) | `bot.schedule.every` | n/a |
| Start speed bonus per ascend | `ascend.speedPerAscend` | added by the PR that adds the speed upgrade |
| Mana, skills | `mana.*`, `skills.*` | added by the PRs that add them |

Rules: a key that doesn't exist is an error (typos must not silently run the default); every output file
carries the resolved tuning so a chart is always traceable to its numbers; at most two sweep keys per chart
(a line chart for one, a heatmap for two).

---

## 5. Outputs

### 5.1 Files

```
sim-out/<scenario>-<yyyymmdd-hhmm>/        (gitignored)
  scenario.resolved.json    scenario + defaults + game version + resolved tuning
  runs.json                 every run: meta, samples, milestones, purchases, ascends
  samples.csv               tidy: one row per run per sample
  milestones.csv            run, variant, level, first_reach_s  (time to stage N, exact to the batch)
  summary.csv               one row per variant: time to world 2/3/5/10 (p10 p50 p90), best level at
                            1h/8h/24h, deaths, ascends, kills, total coins earned and spent
  report.html               self-contained report (5.2), all of the above embedded
```

`samples.csv` columns _(proposal)_: `variant, seed, t_play, t_wall, level, world, stage, best, coins,
income_per_min, spent_total, spent_weapon_upgrade, spent_weapon_buy, spent_character, spent_companion,
spent_ascend, hero_hit, dps_eff, hero_max_hp, defence, crit, mob_hp, mob_damage, ttk, ttd, kills, deaths,
ascends, drops_C, drops_B, drops_A, drops_S, drops_SS, bag_size`. `runs.json` also keeps the purchase log
`{t, kind, target, levelFrom, levelTo, cost}`, which gives "cumulative spend" and "time between purchases".

**Milestones** are recorded when `best` first reaches each stage level, so "time to reach stage N" for **every** N
is free, and the "stage vs time" curve is just its inverse.

### 5.2 HTML report

One self-contained `report.html`: no network, no CDN, no external fonts; data embedded as
`<script type="application/json">`; a few KB of vanilla JS for hover and toggles. It follows the dataviz
conventions:

- **Form by job.** Lines for change over time, bars or dots with a band for "time to N" per setting, a heatmap
  for two swept settings, stacked areas for spend and drops. No dual axes: two measures of different units
  are two stacked panels sharing the x axis.
- **Colour by job.** Different bots or variants (identity) use the categorical palette in fixed order
  (blue, orange, aqua, yellow, magenta, green, violet, red; the validated default in the dataviz reference).
  A **numeric** sweep (drop chance 0.25 % → 2 %) uses one-hue sequential, light to dark. More than 8 series
  become small multiples, or one highlighted line over grey ones. Colour follows the variant, not its rank.
  Item tiers C → S+ are ordered, so they use the sequential ramp; S+ is never rainbow in a chart.
- **Light and dark.** CSS custom properties on `.viz-root`; `prefers-color-scheme` plus a theme toggle
  (`data-theme`), each mode with its own validated steps. The PR that builds it runs the dataviz palette
  validator for both modes and pastes the result.
- **Hover.** Crosshair and one tooltip listing every series at that x on line charts; per-mark tooltips on bars
  and cells; same on keyboard focus.
- **Legend and direct labels.** Legend for two or more series, end-of-line labels for up to four.
- **Table view** under each chart (a `<details>` with the numbers), and dash patterns per series so identity is
  never colour alone (also prints in black and white).
- Header: scenario name, game version, seed and runs, tuning table, bot table.

### 5.3 Charts

| # | Chart | x | y | Form | Series |
| --- | --- | --- | --- | --- | --- |
| 1 | **Progress**: stage level reached | play time (log/linear toggle; wall option) | `best` (labels as `W.S`) | line + p10–p90 band | variant or bot |
| 2 | **Time to reach stage N** | variant | seconds (log) to N = 7 / 13 / 25 / 55 (worlds 2 / 3 / 5 / 10, picker) | dot + range, or bars; heatmap for 2 swept keys | variant |
| 3 | **Power vs wall**: DPS, mob HP, then time-to-kill vs time-to-die | play time | three stacked panels (damage/s, HP, seconds), log y | lines | the selected variants |
| 4 | **Income vs spend** | play time | coins per minute (income, spend) on a log axis; below it cumulative spend stacked by category | line, stacked area | income/spend; category |
| 5 | **Ascends over time** | play time | cumulative ascends; best level per run | step line | variant |
| 6 | **Item drops by tier** | play time (bucketed) | drops per bucket and cumulative | stacked bars | tier C, B, A, S, S+ |
| 7 | **Where time goes** | stage level | seconds spent, deaths | bars | variant (small multiples) |
| 8 | **Time between purchases** | play time | seconds to the next purchase (log) | dots | purchase kind |
| 9 | **Best ascend moment** | ascend threshold level | level or points after 24 h | line + band, peak marked | none (one line) |
| 10 | **KPI row** on top | – | time to World 2 / 3 / 5 / 10 against the targets | stat tiles | – |

Chart 3 is the one that explains the others: where the time-to-kill line goes above the time-to-die line is a
wall, and where upgrades don't catch up is a stall. Chart 7 finds the walls without reading chart 3 for each
variant.

### 5.4 Chart library: plain SVG, no dependency

Decision: **hand-written SVG strings** in `src/sim/chart/` (line, band, bar, stacked area, heatmap, axis and
tick helpers, about 400 lines), no library.

- The report must be one offline file, and the project ships **no runtime dependencies**. uPlot (around 50 KB)
  or Chart.js (around 200 KB) would have to be inlined into every report and the debug build.
- Our data is small: at most about 10 series × 1,500 points per chart. SVG handles that and prints/zooms
  crisply (canvas needs a manual hi-DPI path and has no per-mark hover target).
- The same module renders in Node (report) and in the browser (debug tab), because it only returns strings.
  Labels from files or scenarios go through an escape function (never raw HTML).
- Downsample each line to at most 600 points for the file (keep first, last and milestone points).

---

## 6. Where it lives and how to run it

```
src/sim/                       pure TS, safe in Node and in the browser (no fs / process / DOM)
  types.ts  run.ts  metrics.ts  stats.ts          runner, sampler, percentiles
  options.ts  power.ts                            purchase catalogue, effective DPS / ttk / ttd
  bots/                                           policies + named bots
  tuning.ts  scenario.ts                          overrides, scenario schema + validation
  chart/  report-html.ts                          SVG charts, report builder
  *.test.ts
scripts/sim/                   Node only
  cli.ts  bundle.ts  worker.ts  csv.ts            args, bundling, worker pool, file output
  scenarios/*.json                                shipped scenarios (smoke, baseline, sweeps)
src/ui/sim-panel.ts            the debug tab (PR 7)
```

- `src/sim/` (not `scripts/`) because `tsc --noEmit` and Vitest already cover `src/`, and the debug tab
  imports it.
- `src/game/` imports are extensionless, which plain Node can't resolve. The CLI therefore **bundles
  `src/sim/index.ts` with Vite/esbuild** (`build --ssr`, output in `node_modules/.cache/afk-sim/`) and runs the
  bundle in `worker_threads`, one worker per run, so every run has its own module state (needed for tuning
  overrides and `forcedDrop`). `scripts/colors-doc.ts` already starts Vite from a script, so there is a
  precedent.
- Commands: `npm run sim -- --scenario scripts/sim/scenarios/baseline.json [--out sim-out] [--report]
  [--workers 4] [--runs 5] [--duration 8h] [--seed 7]`. Flags override the file. Also
  `npm run sim -- --list` (bots, tuning keys) and `--from-save save.txt` (start from a real save string).
- **Debug panel tab** (PR 7): "Sim" next to the save editor. Pick a bot, duration (1 h / 8 h / 24 h), a
  couple of knobs and "Start from: new game / my current save"; one run of 8 h is about 0.5 s, so it runs on
  the main thread in chunks (yielding between chunks), then draws charts 1 and 3 with the same `chart/`
  module. The debug panel is statically imported by `game.ts`, and the embed build is IIFE (no code
  splitting), so the PR reports the bundle size change. If it grows more than about 10 KB gzipped, the tab
  becomes a launcher for a `demo/sim.html` page (port 5301, next to the examples page) instead.
- `sim-out/` goes into `.gitignore`. A short scenario (`smoke.json`, 10 min, 2 seeds) runs inside the Vitest
  suite, so CI notices when a game change breaks the sim.

---

## 7. PR split

One thread each, in order. Implementation threads don't edit `docs/` or `CHANGELOG.md`. Each PR targets
`staging`.

| # | Branch | What | Files owned | Tests |
| --- | --- | --- | --- | --- |
| 1 | `code/sim-core` | Seed seam (`newProgress(seed?)`), headless runner, sampler + milestones, **idle bot only**, JSON output, `npm run sim` (bundle + single process), `.gitignore` entry | `src/game/state.ts` (the seam only), `src/sim/{types,run,metrics,index}.ts`, `scripts/sim/{cli,bundle}.ts`, `package.json` (script), `.gitignore` | Same seed gives identical JSON; batch 1 vs batch 60 end in the same state; a hand-checked idle run (stick kills 1.1 at tick 180, coins add up); `best` only grows; JSON round trip; CLI smoke call |
| 2 | `code/sim-bots` | Purchase catalogue, effective-DPS / ttk / ttd helpers, policies: **buy** (greedy, cheap-first, weapon-first, random), **equip**, **sell**, **advance**; named bots `idle-greedy`, `cheap-first`, `no-gear` | `src/sim/{options,power}.ts`, `src/sim/bots/*` | Greedy picks the best gain-per-coin on a fixed state; cheap-first picks the minimum; bots never return a disallowed action (state identity) and coins never go negative; `power` ttk within a few % of a measured real duel; advance policy re-enables only above the margin; same seed gives same purchase log |
| 3 | `code/sim-tuning` | `TUNING` object in `balance.ts`, derived values as functions, `applyTuning` / `resetTuning`. **No behaviour change.** Can run in parallel with PR 2 | `src/game/balance.ts`, `src/sim/tuning.ts` | Golden table of every balance function for stage levels 1–60 equals the pre-refactor values; unknown key throws; override changes the output; reset restores defaults |
| 4 | `code/sim-active-lazy` | **click** policy, **schedule** (`checkIn`, `sessions`, `offline.rate`), **ascend** policy, bots `active`, `lazy-*`. Needs 2 | `src/sim/bots/{click,schedule,ascend}.ts` | Clicks never exceed the cooldown cap; lazy bot does nothing between check-ins and the hero stays rolled back; wall time = play time + gaps; `asap` ascends exactly when `canAscend` |
| 5 | `code/sim-scenarios` | Scenario JSON + validation, variants (`sweep`, `compare`), Monte Carlo seeds, worker pool, CSV + `summary.csv`, shipped scenarios. Needs 1–4 | `src/sim/{scenario,stats}.ts`, `scripts/sim/{worker,csv}.ts`, `scripts/sim/scenarios/*.json` | Validation errors name the key; sweep expands to the right number of variants and refuses over the cap; percentiles; CSV escaping; worker result equals the in-process result; the `smoke` scenario runs in the suite |
| 6 | `code/sim-report` | SVG chart module and `report.html` with charts 1–10 (can start after PR 1 using fixture data). | `src/sim/chart/*`, `src/sim/report-html.ts`, `--report` in the cli | SVG snapshots on a tiny data set; scale and tick maths; the HTML contains no `http(s)://` resource and no external `src`/`href`; labels are escaped; both themes' tokens present; dataviz validator output for both modes pasted in the PR |
| 7 | `ui/sim-debug-tab` | "Sim" tab in the debug panel (run from new game or current save, charts 1 and 3), bundle size note | `src/ui/sim-panel.ts`, one hook in `src/ui/debug.ts` | Panel model (inputs → scenario) is a pure function and tested; run from a save string matches the CLI; manual check in the demo |
| 8 | `docs/balance-report-1` | **First balance report for the owner**: baseline time to World 2 / 3 / 5 / 10 for every named bot, the walls (chart 3 and 7), proposed targets next to measured times, one-at-a-time sensitivity for mob HP growth, upgrade growth, coin growth and drop chance. Output: `report.html` (on `pr-assets`) and `docs/design/balance-report-1.md` | the report doc only | None (a result, not code); the scenario files used are committed in PR 5/8 so it can be re-run |

Notes:

- PRs 1, 3 and 6 are independent enough to run at the same time (different files). 2 needs 1; 4 needs 2; 5
  needs 1–4; 7 needs 6.
- PR 3 touches the file all balance threads edit, so merge it before the "slow progress down" work starts.
  It is the only change to game logic files besides the one-line seed seam.
- Features that land later (ascend bonus, speed upgrade, mana skills, stage picks) each add their own sweep
  key and bot policy in their own PR (section 2.2 rule).
- After PR 8 the sim answers the backlog items it unblocks: slow progress down, item defence, ascend speed,
  mana and skills numbers, the speed upgrade.

---

## 8. Not doing (yet) and risks

- **No re-implementation of combat** in the sim and no closed-form shortcut for outcomes. The sim is the game.
  The closed forms (ttk, ttd) are only for bots' decisions.
- **No fast-forward / skipping.** 24 h in 1.5 s is enough. Revisit only if a sweep gets too slow.
- **No auto-tuning optimiser** (evolutionary / Bayesian search for numbers). Possible later on top of the
  same runner; first look at the charts.
- **No online data.** Real players' behaviour is unknown, so bots are "plausible", not "measured". Treat
  results as ratios and shapes (is the wall in the right place, is idle 3× slower than active), and compare
  with the owner's own playtime.
- **Drift risk.** The sim breaks silently if a feature adds an action the bots don't know. Mitigation: the
  rule in 2.2, the `smoke` scenario in the suite, and PR 2's check that every catalogue entry is covered.
- **Tab pausing is not simulated** beyond the `sessions` model; the sim assumes the game runs whenever the
  scenario says it is "on".

---

## 9. Open questions for the owner

1. **What is the reference player for the pacing targets?** The targets in PLAN (World 2 ≈ 5 min, World 5 ≈ 1 h,
   World 10 ≈ 1 day of AFK) need a player to be measured on. _Recommendation:_ the median player is
   `idle-greedy` (buys things, never clicks). `active` should reach a milestone about 1.5–2× sooner;
   `idle` (never touches anything) should still make slow progress but stall after the first death. The
   first report (PR 8) shows all of them against your numbers.
2. **Will offline progress ever exist?** PLAN says no. _Recommendation:_ keep "no" and measure pace in **play
   time** (tab open and visible). The sim keeps an `offline.rate` knob at 0 so the answer can change later
   without a rewrite, and the report can show wall-clock time for the lazy bots.
3. **How should an AFK player recover from a death?** Today one death turns auto-advance off, and an away
   player waits there until they return, so `lazy-8h` loses most of an overnight. The sim will measure it.
   _Recommendation:_ decide after chart 7, but expect a game change (for example "turn auto-advance back on
   after N seconds of farming" or "retry the stage after a rest"). This one is a game design choice the
   simulator only informs.
4. **Debug tab or demo page?** _Recommendation:_ debug tab first (as asked), measure the bundle in PR 7, and
   fall back to `demo/sim.html` if it costs more than about 10 KB gzipped.
