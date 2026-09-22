# json-render playground

Twenty-four hands-on labs for [json-render](https://json-render.dev) (`vercel-labs/json-render`), pinned to **v0.20.0**
— the version the Taxxa monorepo runs.

You edit specs, break them, and watch what happens. Each lab is a **stepped course**: one stage per json-render
feature, and every stage carries the whole setup as it stands there — the rendered components, the spec you edit,
the state they read, and the catalog and registry entries behind them. The lesson column on the left names the
feature, says when to reach for it and when not to, and checks your work live.

The spec-driven labs render through a shared playground that exposes these panes:

| Pane | What it shows |
|------|---------------|
| **tree** | The element graph the renderer will walk, annotated live: hidden, `repeat ×N`, bound, missing, orphaned. Click a node → raw prop / resolved value / binding path, side by side. |
| **spec json** | Editable. Re-renders on every keystroke that parses; `validateSpec` reports underneath. |
| **state** | The live state model. |
| **catalog** | The `defineCatalog` entries for exactly the components this spec uses. |
| **component code** | The React those component names render as. |
| **log** | Every action dispatch and state write, with paths. |
| **your app code** | The host side: the `JSONUIProvider` call, the handlers or validation functions this lab hands it, and — behind a toggle — the `@json-render` functions that read them. Sliced from the installed dist, so it cannot drift. Present on the actions and validation labs. |

The last two come from `lib/demo/source.generated.ts`, emitted from the real files by `scripts/gen-source.ts` on
every `bun dev` / `bun build` — so what you read is what runs.

Beside the lab sits the **stage rail**: which stage you are on, the concept it introduces, when to reach for that
feature, the reference entries it covers, and the assignment. Concept definitions live in `lib/concepts/` and are
shared with `/reference`; `scripts/check-stages.ts` fails the build if any stage names no feature or does not say
when to use it, and `scripts/audit-coverage.ts` checks each lab actually covers the features its step owns.

Several labs build their own catalog and registry rather than the shared demo one — registry, expressions,
conditions and hooks — so their stages can show a component built for exactly the thing being taught.

```bash
bun install
bun dev          # http://localhost:3000
```

Every lab except the three live-generation ones runs **fully offline**. Those three need a key:

```bash
cp .env.example .env
# AI_GATEWAY_API_KEY=...   from Vercel dashboard -> AI Gateway -> API keys
```

## Pages

| Page | What it is |
|------|------------|
| `/` | Entry point: the three-sentence definition, three track buttons, setup, and every lab. |
| `/path` | **Start here.** Three goal-shaped tracks (write specs · integrate · generate with AI), the seven groups in order, per-step done checkboxes and checkpoint scores in `localStorage`. |
| `/checkpoints/<group>` | One quiz per group, 9–12 questions. Mixed `choice` / `predict` / `spot` / `fill` — the ones that show a spec **render it or run `validateSpec` on it for real** after you answer, so you see the truth rather than our claim. Score is stored and shown back on `/path`. |
| `/reference` | Every field, form, operator, action, check, hook, provider and utility, live and anchored. |
| `/cheatsheet` | The whole library on one page, multi-column and print-friendly. Every signature verbatim from the installed `.d.ts`. |
| `/steps/<slug>` | The 24 labs. |

## Labs

| # | Group | Step | What you do |
|---|-------|------|-------------|
| 1 | Foundations | The shape | Build a tree by hand, break it four ways, watch it fail |
| 2 | Foundations | The catalog | Read an entry, edit the node it permits, break its schema |
| 3 | Foundations | The registry | Two registries over one catalog, then the component context key by key |
| 4 | Data & binding | State & binding | Bind inputs, watch every write, find what breaks a binding |
| 5 | Data & binding | Stores | One spec, three stores; write in from outside React |
| 6 | Data & binding | Expressions | One `$`-form per stage, each on a live tree |
| 7 | Data & binding | Conditions | One way of defining a condition per stage, with controls that flip it |
| 8 | Data & binding | Lists & repeat | Filtered lists, nested lists, `$bindItem` inside rows |
| 9 | Behaviour | Actions & watchers | One binding field per stage; live dispatch timeline; the app code that declares and wires an action |
| 10 | Behaviour | Validation | Add checks to a live form; discover what `validateForm` will not do |
| 11 | Your code | Hooks inside components | One hook per stage: what you hand it, what you get back, and a probe printing it |
| 12 | Your code | Providers & the render tree | Assemble the provider stack piece by piece |
| 13 | Your code | Add a component | Prompt, type contract and registry requirement appear together |
| 14 | Your code | Write the implementation | Write a registry component in a live editor |
| 15 | Your code | Directives | Compose four custom directives, then write one |
| 16 | Your code | Custom checks & handlers | Register a validation function and an action handler |
| 17 | Utilities | Validate & repair | Eight real broken specs, hand-repair vs `autoFixSpec` |
| 18 | Utilities | Other formats | Nested trees and DB rows into the canonical flat spec |
| 19 | AI | Streaming | Step a stream frame by frame, then write your own patches |
| 20 | AI | Live generation † | Generate real UI, read the wire as it arrives |
| 21 | AI | Chat + inline UI † | Mixed-stream parser by hand, then a full chat loop |
| 22 | AI | Refinement † | Send one edit three ways and compare the responses |
| 23 | Shipping | Production patterns | Edit a field definition, watch a compiler rebuild the form |
| 24 | Shipping | Limits & risks | Every silent failure, cost, and security, in one place |

† needs `AI_GATEWAY_API_KEY`.

Step numbers are **display labels only**. In prose, never write "step 14" — use
`<StepRef slug="build-component" />`, which renders the current number and title and links to the lab. Renumbering
is then free, and `lib/steps.ts` stays the single source of truth for order, groups, minutes and key requirements.

## Layout

```
lib/steps.ts               The 24 steps, 7 groups. Derive everything from this.
lib/path.ts                Group↔slug map and the three tracks (derived from steps).
lib/progress.ts            localStorage progress: done steps, checkpoint scores.
lib/concepts/              Concept definitions, shared by the strips and /reference.
lib/reference/             The reference index: fields, forms, operators, anchors.
lib/checkpoints/           One quiz per group, plus the question types.

lib/demo/catalog.ts        13 components + 3 actions. The single source of truth.
lib/demo/components.tsx    Registry impls — thin adapters onto shadcn primitives.
lib/demo/registry.tsx      defineRegistry, with per-component error guards.
lib/demo/specs.ts          Example specs, hand-written.
lib/demo/spec-query.ts     Helpers for writing task assertions.
lib/demo/logging-store.ts  A StateStore decorator — powers the write log.

components/ui/             shadcn primitives (+ Taxxa `action`/`toolbar` variants).
components/playground/     Shared chrome: Panel, Facts, Gotchas, Code, SpecTree.
components/lab/stage-rail.tsx             The lesson column: stage, concept, when, assignment.
components/lab/stage-frame.tsx            The staged shell for labs that are their own instrument.
lib/labs/types.ts                         Stage/StagePart, and the adapters labs build stages with.
components/shell/step-ref.tsx             <StepRef slug="…" /> — never write "step N".
components/lab/            One lab per step, each owning its spec and tasks.
components/path/           The /path track picker and checklist (client).
components/checkpoint/     The quiz runner: live render, live validateSpec.
components/reference/      The /reference explorer.

app/api/generate|chat/     The two AI routes.
scripts/gen-source.ts      Emits the catalog/impl source the labs display.
scripts/check-stages.ts    Build gate: every stage names a feature AND says when to use it.
scripts/audit-coverage.ts  Does each lab cover the features its step owns?
scripts/write-tracking.ts  Regenerates docs/STAGE-COVERAGE.md.
```

Everything renders through **one** catalog and **one** registry, so a spec copied out of the first lab still works
in the last one.

## Design

UI follows the Taxxa design language (`.claude/skills/taxxa-design` in the `chats` monorepo): warm stone surfaces,
zinc hairlines instead of shadows, mono for titles and micro-labels, Geist Sans for body, one orange accent per
region, functional hues (red/blue/emerald/yellow) carrying meaning rather than decoration.

Tokens in `app/globals.css` are copied from `apps/frontend/app/globals.css`. That file is a shadcn v4
CSS-variable theme (`baseColor: stone`, `cssVariables: true`), so shadcn components drop in already themed — which
is why this app uses them rather than hand-rolled primitives.

## Stack

Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · AI SDK v7 (`ai@^7`) · `@ai-sdk/gateway` · zod v4
