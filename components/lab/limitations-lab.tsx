'use client';

import { useState } from 'react';
import { Code, Facts, Gotcha, Gotchas, Takeaway } from '@/components/playground/ui';
import { StepRef } from '@/components/shell/step-ref';
import { StageFrame } from './stage-frame';

/**
 * A reading lesson, not a playground.
 *
 * This step has nothing to run — it is every silent failure, cost and risk in
 * one place — so its stages are sections and "done" means you have read them.
 * That is honest rather than inventing assignments over reference material,
 * and it keeps the step in the same shape as the twenty-three around it.
 */
const LIMITATION_STAGES = [
  {
    id: 'silent',
    title: 'Every silent failure',
    when:
      'Read this before deciding how much guarding a route deserves. Every entry here is a wrong page rather than an error, so the budget you set — validate, fall back, log — is all that stands between a defect and a support ticket months later. On a compiled spec most of the list cannot happen, and that guarding is waste.',
    concept: 'silent-failures',
    summary:
      'None of these throw and none of them log. Each one renders a plausible-looking wrong UI, which is why they cost so much more to find than a crash would.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
  {
    id: 'cannot',
    title: 'What a spec cannot do',
    when:
      'This is the list that tells you a spec is the wrong container for the thing you are reaching for. Arithmetic, formatting, per-component state: register a `$computed`, or move the logic into your component or your compiler, and stop trying to express it in JSON the moment you want a second one.',
    ref: 'expr-computed',
    summary:
      'The format has no loops, no arithmetic and no way to hold code. Everything below is a thing you will reach for once, not find, and have to solve in your own components or in a compiler instead.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
  {
    id: 'navstack',
    title: 'The undocumented nav stack',
    when:
      'Never in generated output — `catalog.prompt()` cannot name `push`, so no model will emit it and asking for a two-screen flow gets you a boolean and two `visible` conditions instead. Use it only in a spec you compiled and shipped yourself, and only if two runtime-owned paths in your state model are acceptable; for anything a product routes on, register your own action with the same shape.',
    concept: 'nav-stack',
    ref: 'act-pushpop',
    summary:
      'The runtime ships two actions the prompt never mentions. They work, they write to hard-coded paths, and no model will ever emit them on its own.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
  {
    id: 'cost',
    title: 'What it costs',
    when:
      'These are the numbers that decide generate against compile. Thousands of tokens and seconds of latency per request are worth paying for a UI nobody could have specified in advance; they are indefensible for a settings form, and refinement makes the bill grow with everything the user has already built.',
    concept: 'four-risk-levels',
    summary:
      'The catalog becomes the prompt, so every component and prop you declare is paid for on every request. Generation is the expensive mode; a compiled spec costs nothing per render.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
  {
    id: 'security',
    title: 'Security',
    when:
      'Read this before letting a generated spec name an action rather than only display data — that step, from read-only views to generated UI with actions, is where reviewing your own components stops being optional. Sanitise inside the component and authorise inside the handler; no amount of validating the spec upstream substitutes for either.',
    concept: 'attack-surface',
    summary:
      'A spec cannot execute code, which is a genuinely strong position. What it can do is hand your own components values they were not written to receive.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
  {
    id: 'defensive',
    title: 'A defensive render path',
    when:
      'Reach for the whole path whenever a spec came from a model, and keep its order, because the order is the lesson: guard, validate, repair, then render behind a fallback. Withhold the lossy pass until the last attempt — pulling it forward always produces something that renders, so you ship the half-empty page instead of spending the retry that would have filled it.',
    ref: 'util-autofixspec',
    summary:
      'The order matters: check it is a spec at all, validate its structure, repair what is safely repairable, and only then render with a fallback in place.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
  {
    id: 'reference',
    title: 'Where to go next',
    when:
      'Reach for a second renderer when the same catalog must draw somewhere else entirely, and for a store adapter when the app already has a state library. Neither is the answer to wanting a different look, which is a change inside the components you already have — they are the arguments for keeping UI as data in the first place.',
    ref: 'util-createstoreadapter',
    summary:
      'The library, the other renderers, and the store adapters — one spec rendered as both a web form and a PDF is the strongest argument for the whole approach.',
    parts: [{ goal: 'Read this section — there is nothing to run here, only things to know before you ship.', done: true }],
  },
];

const SECTIONS: Record<string, React.ReactNode> = {
  silent: (
    <>
        <p>
          None of these throw. None log. All of them render a plausible-looking wrong UI.
        </p>
        <Facts
          rows={[
            { k: <code key="1">spec.state</code>, v: 'The renderer never reads it. You seed the store. Symptom: generated UI renders as an empty shell.' },
            { k: 'dangling child key', v: 'That branch disappears. Symptom: a section the spec clearly describes is missing.' },
            { k: 'unknown component type', v: <>Renders your <code key="2">fallback</code>, or nothing if you did not pass one.</> },
            { k: <code key="3">visible/on/repeat/watch</code>, v: 'Inside props they are inert. Symptom: a button that does nothing; a condition that never fires.' },
            { k: 'malformed visible', v: 'Not an error, and not reliably hidden. An unknown operator is ignored and the condition degrades to a truthiness check; an object with no $-key is always visible. validateSpec reports invalid_visible.' },
            { k: 'unregistered $computed', v: 'Resolves to undefined. Symptom: a blank prop.' },
            { k: 'unregistered check type', v: 'Never runs. Symptom: a field that always validates clean.' },
            { k: 'missing $bindState', v: 'Input is read-only. Symptom: "I cannot type in this field."' },
            { k: <code key="4">validateForm</code>, v: 'Reports, does not block. Symptom: invalid submissions.' },
            { k: 'merge/diff via useUIStream', v: 'Silently ignored. Symptom: an edit that appears to succeed and changes nothing.' },
            { k: 'confirm on a built-in action', v: 'Bypassed entirely — built-ins return before the confirm branch.' },
            { k: <code key="5">watch</code>, v: <>An array on one <code key="6">watch</code> entry runs only up to and including its first state-changing binding. That write tears down the effect running the loop, and the rest are dropped — no warning, clean <code key="7">validateSpec</code>. Symptom: the last step of a cascade never happens. One binding per entry.</> },
          ]}
        />

    </>
  ),
  cannot: (
    <>
        <Facts
          rows={[
            { k: 'no logic', v: <>No arithmetic, no property access, no method calls. <code key="a">/items/length</code> is a key lookup. <code key="b">$computed</code> is the only escape.</> },
            { k: 'no styling', v: 'No colours, widths, margins or classes. Appearance lives in your components; the only lever is a prop you chose to expose.' },
            { k: 'no lifecycle', v: <><code key="c">watch</code> is the sole reactive primitive. Nothing runs on mount or on an interval.</> },
            { k: 'no local state', v: 'One flat model, shared. Two bound controls on one path are one control.' },
            { k: 'no state schema', v: 'Nothing declares which paths exist or what they hold. A typo is undefined. Validate with Zod at the boundary.' },
          ]}
        />

    </>
  ),
  navstack: (
    <>
        <p>
          <code>ActionProvider</code> handles two actions beside <code>setState</code> and friends, and nothing the
          library writes ever mentions either of them. Together they are a navigation stack.
        </p>
        <Code lang="json">{`{ "on": { "press": { "action": "push", "params": { "screen": "detail" } } } }
{ "on": { "press": { "action": "pop" } } }`}</Code>
        <Facts
          rows={[
            { k: <code key="p">push</code>, v: <>Reads <code key="p1">/currentScreen</code>, appends it to <code key="p2">/navStack</code> — appending <code key="p3">&quot;&quot;</code> when it is empty — then sets <code key="p4">/currentScreen</code> to <code key="p5">params.screen</code>.</> },
            { k: <code key="o">pop</code>, v: <>Takes the last entry off <code key="o1">/navStack</code> and restores it to <code key="o2">/currentScreen</code>. An empty entry leaves <code key="o3">/currentScreen</code> undefined.</> },
            { k: 'the two paths', v: <>Hard-coded, spelled exactly <code key="h1">/navStack</code> and <code key="h2">/currentScreen</code>. There is no option to rename either, so those two paths in your state model belong to the runtime whether you wanted them to or not.</> },
            { k: 'what renders', v: <>Nothing. The actions move state and stop there — you still switch on <code key="r1">/currentScreen</code> yourself with <code key="r2">visible</code>.</> },
          ]}
        />
        <Gotchas>
          <Gotcha><strong>The model does not know they exist.</strong> Neither action is in the schema&rsquo;s{' '}
              <code>builtInActions</code> list, so <code>catalog.prompt()</code> never names them. Generated specs
              therefore never contain a <code>push</code>: ask for a two-screen flow and you get a boolean and two{' '}
              <code>visible</code> conditions instead. Symptom: a feature you know the runtime has that you can never
              get the model to use.</Gotcha>
          <Gotcha><strong>Undocumented is not the same as stable.</strong> This is read out of{' '}
              <code>ActionProvider</code> in the installed build, not out of a contract. Safe enough in a spec you
              compiled and shipped yourself; not something to route a product on.</Gotcha>
          <Gotcha><strong>The stack is state like any other.</strong> It is in the same flat model as your form
              values, so it is seeded, serialised and sent back to the model with everything else — and anything else
              that writes <code>/currentScreen</code> moves the screen.</Gotcha>
        </Gotchas>
        <p>
          If you want navigation in generated output, do not reach for these. Register an action of your own with the
          same shape (<StepRef slug="actions" />) and put it in the catalog, where the prompt can see it.
        </p>

    </>
  ),
  cost: (
    <>
        <Facts
          rows={[
            { k: 'system prompt', v: '~4,500 tokens at 13 components; 15k–30k for a real design system. Every request. Cache the prefix, or build a narrower catalog per request.' },
            { k: 'refinement', v: 'Each edit ships the whole current spec. Cost grows with what the user built — backwards from what they expect.' },
            { k: 'expression resolution', v: 'Eager, per render, per visible element. Fine for forms and dashboards; not for 10k-row tables.' },
            { k: 'latency', v: 'Seconds, not milliseconds. Streaming hides it, which is the point of the patch protocol.' },
          ]}
        />

    </>
  ),
  security: (
    <>
        <Takeaway>
          A spec cannot execute code. No <code>eval</code>, no handler bodies, no arbitrary expressions — it can only
          name components, actions and functions you already implemented. That is a genuinely strong position, and
          the reason to prefer this over &ldquo;let the model emit JSX&rdquo;.
        </Takeaway>

        <Gotchas>
          <Gotcha><strong>Your components are the attack surface.</strong> A prop reaching{' '}
              <code>dangerouslySetInnerHTML</code>, an <code>href</code> accepting <code>javascript:</code>, an image{' '}
              <code>src</code> leaking a token. Sanitise inside the component; the spec layer will not.</Gotcha>
          <Gotcha><strong>Actions do whatever you implemented.</strong> If <code>deleteRecord</code> is in the catalog, a
              generated spec can bind it to a button. Authorise inside the handler, server-side, against the real
              user.</Gotcha>
          <Gotcha><strong>State paths are unconstrained.</strong> A <code>$bindState</code> can point anywhere in the
              model, including somewhere your app treats as trusted. Never let a model choose a path that writes to a
              real record — compile bindings instead (<StepRef slug="patterns" />).</Gotcha>
          <Gotcha><strong>Prompt injection reaches the UI.</strong> Untrusted content in the generation context can
              influence what gets rendered, including plausible text next to a real action button. Generated UI
              inherits every injection risk of the pipeline that produced it.</Gotcha>
        </Gotchas>

    </>
  ),
  defensive: (
    <>
        <Code lang="typescript">{`import { validateSpec, autoFixSpec, isNonEmptySpec } from '@json-render/core';

  function prepare(raw: unknown, attempt: number, maxAttempts: number) {
    if (!isNonEmptySpec(raw)) return { ok: false, reason: 'empty' } as const;

    // Lossless fixes always; withhold pruning until the last attempt, or you
    // silently ship the half-empty UI.
    const lastChance = attempt >= maxAttempts;
    const { spec, fixDetails } = autoFixSpec(raw, { lossy: lastChance });

    const { valid, issues } = validateSpec(spec);
    if (!valid && !lastChance) return { ok: false, reason: 'retry', issues } as const;

    log({ fixes: fixDetails, issues });
    return { ok: true, spec } as const;
  }`}</Code>
        <p>
          Feed <code>issues</code> back into the retry prompt verbatim. A model told{' '}
          <em>&ldquo;Element X references child Y which does not exist&rdquo;</em> fixes it far more reliably than
          one told to try again.
        </p>

    </>
  ),
  reference: (
    <>
        <Facts
          rows={[
            { k: <a key="d" href="https://json-render.dev">json-render.dev</a>, v: 'Official docs' },
            { k: <a key="g" href="https://github.com/vercel-labs/json-render">vercel-labs/json-render</a>, v: 'Source. This playground pins 0.20.0; 0.21.0 is current.' },
            { k: 'other renderers', v: <><code key="e">@json-render/react-native</code>, <code key="f">@json-render/react-pdf</code>. One spec rendered as both a web form and a PDF is the strongest argument for the whole approach.</> },
            { k: 'store adapters', v: <><code key="h">@json-render/redux</code>, <code key="i">@json-render/zustand</code>, <code key="j">@json-render/jotai</code> — all thin wrappers over <code key="k">createStoreAdapter</code>.</> },
          ]}
        />
    </>
  ),
};

export function LimitationsLab() {
  const [read, setRead] = useState<Set<string>>(new Set([LIMITATION_STAGES[0].id]));
  const [current, setCurrent] = useState(LIMITATION_STAGES[0].id);

  return (
    <StageFrame
      slug="limitations"
      stages={LIMITATION_STAGES.map((s) => ({ ...s, parts: s.parts.map((p) => ({ ...p, done: read.has(s.id) })) }))}
      onStageChange={(stage) => {
        setCurrent(stage.id);
        setRead((prev) => new Set(prev).add(stage.id));
      }}
    >
      {() => (
        <div className="prose-doc min-h-0 flex-1 overflow-auto rounded-lg border bg-card px-6 py-5">
          {SECTIONS[current]}
        </div>
      )}
    </StageFrame>
  );
}
