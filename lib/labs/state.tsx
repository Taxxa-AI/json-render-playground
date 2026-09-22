import type { Spec } from '@json-render/core';
import { at, usesExpression } from '@/lib/demo/spec-query';
import type { SpecLabScript } from './types';

/**
 * The state & binding lab, as stages.
 *
 * Read this file top to bottom and you read the lab: four spec snapshots in
 * the order the learner meets them, then five stages that point at them. Every
 * stage owns the COMPLETE spec it starts from, so nothing here is a fragment
 * and nothing depends on the learner having got the previous stage right.
 */

export const SEED = { user: { first: 'Ada', news: false } };

/** Stage 1-2. `last` is a plain literal, which is the bug the lab is built on. */
const LITERAL_LAST: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card', 'echo'] },
    card: {
      type: 'Card',
      props: { title: 'Bound inputs', subtitle: 'Every keystroke writes to the state model' },
      children: ['first', 'last', 'news'],
    },
    first: {
      type: 'TextInput',
      // $bindState — two-way.
      props: { label: 'First name', value: { $bindState: '/user/first' }, placeholder: 'Ada', help: null, required: null, checks: null },
      children: [],
    },
    last: {
      // NOTE: a plain literal, NOT a binding. Try typing in it.
      type: 'TextInput',
      props: { label: 'Last name (not bound)', value: 'Lovelace', placeholder: null, help: null, required: null, checks: null },
      children: [],
    },
    news: { type: 'Checkbox', props: { label: 'Monthly digest', checked: { $bindState: '/user/news' } }, children: [] },
    echo: {
      type: 'Alert',
      // $state — one-way read.
      props: { title: 'Read back via $state', message: { $state: '/user/first' }, tone: 'info' },
      children: [],
    },
  },
};

/** Stage 3-5. The literal on `last` replaced by a two-way binding. */
const BOUND_LAST: Spec = {
  root: 'screen',
  elements: {
    ...LITERAL_LAST.elements,
    last: {
      type: 'TextInput',
      props: {
        label: 'Last name',
        value: { $bindState: '/user/last' },
        placeholder: null,
        help: null,
        required: null,
        checks: null,
      },
      children: [],
    },
  },
};

/** Stage 6. …plus a control bound to a branch of state that does not exist yet. */
const WITH_CITY: Spec = {
  root: 'screen',
  elements: {
    ...BOUND_LAST.elements,
    card: { ...LITERAL_LAST.elements.card, children: ['first', 'last', 'news', 'city'] },
    city: {
      type: 'TextInput',
      props: {
        label: 'City',
        value: { $bindState: '/company/address/city' },
        placeholder: null,
        help: null,
        required: null,
        checks: null,
      },
      children: [],
    },
  },
};

export const STATE_LAB: SpecLabScript = {
  slug: 'state',
  stages: [
    {
      id: 'read',
      title: 'One path, every reader',
      concept: 'state-read',
      when:
        'Anything the screen only displays, and anywhere two parts of the page must agree — they agree by pointing at the same path, not by being wired to each other. Reach for `$bindState` the moment a control has to write back, and for `$template` when the value belongs inside a sentence rather than filling the whole prop.',
      also: ['spec-state-ignored'],
      panes: ['state', 'log'],
      spec: LITERAL_LAST,
      seed: SEED,
      parts: [
        {
          goal: (
            <>
              Type in <strong>First name</strong> and watch three things move at once: the alert, the{' '}
              <strong>state</strong> tab and the <strong>log</strong>. One keystroke, one state write, every reader
              updated.
            </>
          ),
          hint: 'The input, the alert and the state model are not wired to each other. They all point at the same path, /user/first, and the store notifies everyone who reads it.',
          steps: [
            <>
              In <strong>rendered output</strong> on the left, click into the <strong>First name</strong> field. It
              already reads <code>Ada</code>.
            </>,
            <>
              Type <code> Byron</code> on the end.
            </>,
            <>
              Watch the blue <strong>Read back via $state</strong> alert under the card — it follows every keystroke,
              and nothing connects it to the input but the path.
            </>,
            <>
              Click the <strong>log</strong> tab: one green <code>write /user/first = "Ada Byron"</code> line per
              keystroke.
            </>,
            <>
              Click the <strong>state</strong> tab and read <code>"first"</code> — it holds exactly what you typed.
            </>,
          ],
          check: ({ written }) => written.includes('/user/first'),
        },
      ],
    },
    {
      id: 'stuck',
      title: 'The field that will not type',
      concept: 'literal-is-readonly',
      when:
        'A literal is right for anything the user will never change — a label, a placeholder, a fixed title. Reach for this diagnosis the moment a field refuses to type: look at `value` for a literal or a `$state` before you suspect the component, because both look editable and neither is.',
      panes: ['spec', 'tree'],
      spec: LITERAL_LAST,
      seed: SEED,
      parts: [
        {
          goal: (
            <>
              Try typing in <strong>Last name</strong>. It refuses — and the reason is the single most common
              json-render bug, so work it out from the spec before opening the hint.
            </>
          ),
          hint: 'Rule: only {"$bindState": "/path"} is writable. Its value prop is the literal string "Lovelace", so bindings.value is undefined, and useBoundProp has nowhere to write — setValue is a no-op. Replace the literal with { "$bindState": "/user/last" }.',
          steps: [
            <>
              Click into <strong>Last name (not bound)</strong> in <strong>rendered output</strong> and type. The text
              never changes.
            </>,
            <>
              Open the <strong>spec json</strong> tab and find the <code>{'"last": {'}</code> block.
            </>,
            <>
              Read its <code>value</code>: the literal string <code>"Lovelace"</code>, with no <code>$bindState</code>{' '}
              anywhere.
            </>,
            <>
              Replace <code>"value": "Lovelace"</code> with <code>{'"value": { "$bindState": "/user/last" }'}</code>.
            </>,
            <>
              Click the <strong>tree</strong> tab: the <code>TextInput last</code> row now carries a green{' '}
              <strong>bound</strong> tag, exactly like <code>first</code>.
            </>,
          ],
          // The same constant the next stage starts from — the two cannot drift.
          solution: {
            spec: BOUND_LAST,
            note: 'Only $bindState puts an entry in bindings, and useBoundProp needs that entry to have anywhere to write. A literal value prop makes the control permanently read-only.',
          },
          check: ({ spec }) => usesExpression(spec?.elements?.last?.props, '$bindState'),
        },
      ],
    },
    {
      id: 'bind',
      title: '$bindState writes',
      concept: 'bind-state',
      when:
        'Every control the user edits. Reach for `$state` instead when the value is only displayed — a read-only binding on an input is the most common cause of "my field will not type", so the choice is not stylistic.',
      ref: 'expr-bindstate',
      refs: ['ctx-bindings'],
      panes: ['state', 'log'],
      spec: BOUND_LAST,
      seed: SEED,
      parts: [
        {
          goal: (
            <>
              With <code>last</code> bound, type a surname and confirm it lands in the state model. The control was
              never broken — it just had nothing to write to.
            </>
          ),
          hint: 'Check the state tab for /user/last. If you bound a different path, that is fine — the point is that the control now has one.',
          steps: [
            <>
              Click into the <strong>Last name</strong> field in <strong>rendered output</strong>.
            </>,
            <>
              Type <code>Lovelace</code>. This time the characters appear.
            </>,
            <>
              Click the <strong>log</strong> tab: <code>write /user/last = "Lovelace"</code>, one line per keystroke.
            </>,
            <>
              Click the <strong>state</strong> tab: <code>"last"</code> now sits beside <code>"first"</code> under{' '}
              <code>user</code>.
            </>,
          ],
          check: ({ state }) => typeof at(state, '/user/last') === 'string' && String(at(state, '/user/last')).length > 0,
        },
      ],
    },
    {
      id: 'checkbox',
      title: 'Bind the natural prop',
      concept: 'natural-value-prop',
      when:
        'Every binding, every time — there is no generic `statePath` prop to reach for instead, so the only question is which prop is the natural one: `value` for a text field, `checked` for a checkbox. It is not cosmetic: the prop name you write is the key the component reads back out of `bindings`, so a binding on the wrong prop leaves the control silently read-only.',
      panes: ['spec', 'impl', 'state'],
      spec: BOUND_LAST,
      seed: SEED,
      parts: [
        {
          goal: (
            <>
              Tick the digest checkbox. The bound prop is <code>checked</code>, not <code>value</code> — a binding
              always goes on the component&rsquo;s <em>natural</em> value prop, and there is no generic{' '}
              <code>statePath</code>.
            </>
          ),
          hint: 'Rule: the prop name in the spec is the key you get back in bindings. Look at the Checkbox implementation in the component code tab: useBoundProp(props.checked, bindings?.checked).',
          steps: [
            <>
              In <strong>rendered output</strong>, tick <strong>Monthly digest</strong>.
            </>,
            <>
              Open the <strong>spec json</strong> tab and read the <code>news</code> element: the binding sits on{' '}
              <code>checked</code>, not on <code>value</code>.
            </>,
            <>
              Click the <strong>component code</strong> tab and find <code>Checkbox</code>:{' '}
              <code>useBoundProp(props.checked, bindings?.checked)</code> — the prop name in the spec is the key it
              reads back.
            </>,
            <>
              Click the <strong>state</strong> tab: <code>"news": true</code>.
            </>,
          ],
          check: ({ state }) => at(state, '/user/news') === true,
        },
      ],
    },
    {
      id: 'nested',
      title: 'State has no declared shape',
      // The pointer card lives here now: this is the stage that writes one
      // (`/company/address/city`), and its own stage was a dead end.
      also: ['json-pointer'],
      when:
        'Lean on it when a form fills in a branch that does not exist yet — a new record, an optional address — and you would rather not seed empty objects first. Do not lean on it for anything you read back later: nothing declares the shape, so a typo grows a second branch instead of failing, and the only defences are seeding the store with the shape you expect and keeping paths in one place.',
      ref: 'el-state',
      panes: ['state', 'spec'],
      // No concept card covers this one yet — the rail makes that visible
      // rather than hiding it, so it is easy to come back and write one.
      summary:
        'Nothing anywhere declares what the state model contains. A write creates every object on the way down, which is exactly why a typo in a path is never an error — it silently grows a new branch instead.',
      spec: BOUND_LAST,
      seed: SEED,
      parts: [
        {
          goal: (
            <>
              Bind a control to a path that does not exist yet — say <code>/company/address/city</code> — and type into
              it. Intermediate objects are created for you.
            </>
          ),
          hint: 'Rule: nothing declares the state shape, so a write creates whatever branch it needs. Add "city": { "type": "TextInput", "props": { "label": "City", "value": { "$bindState": "/company/address/city" }, "placeholder": null, "help": null, "required": null, "checks": null }, "children": [] } and put "city" in card.children.',
          steps: [
            <>
              Click the <strong>state</strong> tab first and note what is there: one <code>user</code> object, no{' '}
              <code>company</code>.
            </>,
            <>
              Open the <strong>spec json</strong> tab and add a new element to <code>elements</code>:{' '}
              <code>
                {'"city": { "type": "TextInput", "props": { "label": "City", "value": { "$bindState": "/company/address/city" }, "placeholder": null, "help": null, "required": null, "checks": null }, "children": [] }'}
              </code>
              .
            </>,
            <>
              Append the string <code>"city"</code> to the <code>card</code> block&rsquo;s <code>children</code> array.
            </>,
            <>
              In <strong>rendered output</strong>, type <code>Helsinki</code> into the new <strong>City</strong> field.
            </>,
            <>
              Click the <strong>state</strong> tab: a whole{' '}
              <code>{'"company": { "address": { "city": "Helsinki" } }'}</code> branch has appeared, built by the write
              itself.
            </>,
          ],
          solution: {
            spec: WITH_CITY,
            note: 'Applies the City control bound to /company/address/city; type into it and the store creates every intermediate object on the way down.',
          },
          check: ({ state }) => typeof at(state, '/company/address/city') === 'string',
        },
      ],
    },
  ],
};
