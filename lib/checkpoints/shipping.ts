import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * Shipping — production patterns and the risks you sign up for.
 *
 * Verified with scratchpad/verify-checkpoints.ts (V1 — an unknown check type
 * returns valid: true) and against the runtime behaviours collected on the
 * limitations lab: `runValidationCheck`, `ActionProvider`, `resolvePropValue`,
 * `autoFixSpec`.
 */
export const shippingQuiz: Quiz = {
  group: 'Shipping',
  slug: 'shipping',
  intro: 'What survives production, what breaks quietly, and what a model must never decide.',
  questions: [
    {
      kind: 'choice',
      id: 's-fixed-spec',
      prompt: 'A regulated invoice form has to be identical every time. What is the right way to use json-render for it?',
      options: [
        'Compile the spec from your domain model in code — no model in the loop at runtime',
        'Generate it once, cache the spec, and regenerate nightly',
        'Generate it per request with temperature 0',
        'Generate it per request and repair with autoFixSpec until validateSpec passes',
      ],
      answer: 0,
      explain:
        'The renderer does not care where a spec came from. A function from your field definitions to a Spec gives you the same runtime, the same components and the same bindings with none of the latency, cost or nondeterminism — and the UI changes when the domain model changes, in a diff a reviewer can read. Generation earns its place where the shape genuinely cannot be known in advance.',
      step: 'patterns',
      ref: 'util-validatespec',
    },
    {
      kind: 'choice',
      id: 's-state-paths',
      prompt: 'Which is the most dangerous thing to let a model choose freely?',
      options: [
        'The state path a control writes to',
        'The tone prop on a badge',
        'The order of children in a stack',
        'The text of a heading',
      ],
      answer: 0,
      explain:
        'A $bindState can point anywhere in the model, including a branch your app treats as trusted — a user id, a tenant, a computed total. Nothing in the spec layer constrains it. Where a write path matters, compile the binding yourself and let the model choose only labels and layout.',
      step: 'limitations',
      ref: 'expr-bindstate',
    },
    {
      kind: 'choice',
      id: 's-actions',
      prompt: 'deleteRecord is in your catalog. A generated spec binds it to a button. Where does authorisation belong?',
      options: [
        'Inside the handler, server-side, against the real user',
        'In the catalog description, telling the model when not to use it',
        'In a visible condition on the button',
        'In validateSpec, as a custom issue code',
      ],
      answer: 0,
      explain:
        'Anything in the catalog is callable by any spec, and a visible condition only hides a button — it does not stop an action. The catalog is a menu, not a permission model. Authorise where the work happens.',
      step: 'limitations',
      ref: 'act-binding',
    },
    {
      kind: 'choice',
      id: 's-injection',
      prompt: 'Untrusted text (a support ticket, a scraped page) is in the generation context. What is the new risk?',
      options: [
        'It can influence what renders — including plausible copy next to a real action button',
        'It can inject JavaScript into the spec',
        'It can add components that are not in the catalog',
        'None — the spec format is declarative',
      ],
      answer: 0,
      explain:
        'Generated UI inherits every injection risk of the pipeline that produced it. The attacker cannot add a component or run code, but they can shape what a trusting user is shown and which of your real actions sits under the button labelled "Confirm". Treat generated copy as untrusted content, not as your own.',
      step: 'limitations',
      ref: 'act-binding',
    },
    {
      kind: 'choice',
      id: 's-no-eval',
      prompt: 'What is the genuinely strong security property of the spec format — and where does it stop?',
      options: [
        'A spec cannot execute code; it can only name things you implemented — but your components are the attack surface',
        'A spec cannot reach the network; but it can read any state path',
        'A spec is validated against the catalog; but validation can be disabled',
        'A spec is sandboxed in a worker; but the worker shares your session',
      ],
      answer: 0,
      explain:
        'There is no eval, no handler body and no arbitrary expression — a spec can only reference components, actions and functions that already exist in your code. That is a much better position than "let the model emit JSX". It stops at your components: a prop reaching dangerouslySetInnerHTML, an href accepting javascript:, an image src leaking a token. Sanitise inside the component.',
      step: 'limitations',
      ref: 'ctx-props',
    },
    {
      kind: 'predict',
      id: 's-unknown-check',
      prompt: 'The check type "strongPassword" is not registered. Reveal, then type something weak and click away.',
      // Verified (V1): runValidationCheck returns { valid: true } and warns once
      // — "Don't fail on unknown functions" is a comment in the source.
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'Sign up', subtitle: null }, children: ['pw'] },
          pw: {
            type: 'TextInput',
            props: {
              label: 'Password',
              value: { $bindState: '/form/password' },
              placeholder: 'anything at all',
              help: 'Blur the field. Nothing complains.',
              required: true,
              checks: [{ type: 'strongPassword', args: null, message: 'Password is too weak' }],
            },
            children: [],
          },
        },
      } as unknown as Spec,
      seed: { form: { password: '' } },
      options: [
        'The field always validates clean — an unknown check returns valid: true',
        'The field always fails — an unknown check returns valid: false',
        'The field throws on blur',
        'The check is skipped and the field falls back to `required`',
      ],
      answer: 0,
      explain:
        'An unknown check type warns once and returns valid: true, deliberately, so a typo cannot lock a user out of a form. The cost is the opposite failure: a field that always reports clean. Every check type in a spec must exist in the built-ins or in validationFunctions, and nothing enforces that.',
      step: 'limitations',
      ref: 'val-result',
    },
    {
      kind: 'choice',
      id: 's-one-model',
      prompt: 'Two inputs in different parts of the spec both bind /form/email. What have you built?',
      options: [
        'One control shown twice — typing in either updates both',
        'Two independent drafts, merged on submit',
        'A validation error at render time',
        'Two controls; the last one to render wins',
      ],
      answer: 0,
      explain:
        'There is one flat state model and no component-local state in the spec language. Two bindings to one path are one value. That is occasionally what you want — a mirrored summary field — and usually a sign that the model reused a path it should not have.',
      step: 'limitations',
      ref: 'expr-bindstate',
    },
    {
      kind: 'choice',
      id: 's-no-lifecycle',
      prompt: 'A generated dashboard needs to load its data when it appears. What does the spec language offer?',
      options: [
        'Nothing — watch fires only on change, and there is no mount hook or interval',
        'An onMount event on every element',
        'repeat with an empty statePath triggers a load',
        'watch on a path that does not exist yet fires once',
      ],
      answer: 0,
      explain:
        'watch is the only reactive primitive, and it establishes a baseline on the first pass rather than firing. Nothing runs on mount, on a timer, or on navigation. Load data before you render, or dispatch imperatively with the executeAction that defineRegistry returns.',
      step: 'limitations',
      ref: 'el-watch',
    },
    {
      kind: 'choice',
      id: 's-defensive',
      prompt: 'In a repair loop with retries remaining, how should you call autoFixSpec?',
      options: [
        '{ lossy: false } — then re-prompt with formatSpecIssues, and allow lossy only on the last attempt',
        '{ lossy: true } every time, so the user always sees something',
        'Not at all — always re-prompt on any issue',
        '{ lossy: true }, then validateSpec with checkOrphans to catch what was pruned',
      ],
      answer: 0,
      explain:
        'Lossless fixes are free: they only relocate misplaced fields. Lossy fixes make a spec valid by deleting content the user asked for, so accepting one while a retry is still available trades a fixable problem for a permanent one. Feed the validateSpec issues back verbatim; take the pruned spec only as a last resort, and log that you did.',
      step: 'repair',
      ref: 'util-autofixspec',
    },
  ],
};
