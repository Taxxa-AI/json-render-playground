'use client';

import type { Spec } from '@json-render/core';
import { SpecPlayground } from '../playground/spec-playground';
import { stagesFromTasks } from '@/lib/labs/types';
import type { Task } from './task-list';
import { at, deepFind } from '@/lib/demo/spec-query';
import { IMPL_ENTRIES } from '@/lib/demo/source.generated';
import type { WiringBlock } from '../playground/wiring-pane';

const SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card'] },
    card: {
      type: 'Card',
      props: { title: 'Sign up', subtitle: 'Blur a field to validate it' },
      children: ['email', 'pw', 'pw2'],
      slots: { footer: ['submit'] },
    },
    email: {
      type: 'TextInput',
      props: {
        label: 'Email',
        value: { $bindState: '/form/email' },
        placeholder: 'you@company.com',
        help: null,
        required: true,
        checks: [{ type: 'required', args: null, message: 'Email is required' }],
      },
      children: [],
    },
    pw: {
      type: 'TextInput',
      props: {
        label: 'Password',
        value: { $bindState: '/form/password' },
        placeholder: null,
        help: 'At least 8 characters.',
        required: true,
        // Intentionally missing minLength — task 2 adds it.
        checks: [{ type: 'required', args: null, message: 'Password is required' }],
      },
      children: [],
    },
    pw2: {
      type: 'TextInput',
      props: {
        label: 'Confirm password',
        value: { $bindState: '/form/confirm' },
        placeholder: null,
        help: null,
        required: true,
        checks: null,
      },
      children: [],
    },
    submit: {
      type: 'Button',
      props: { label: 'Create account', variant: 'primary' },
      // An array of bindings runs in order.
      on: {
        press: [
          { action: 'validateForm', params: { statePath: '/result' } },
          { action: 'submit', params: {} },
        ],
      },
      children: [],
    },
  },
};

export const VALIDATION_LAB_SEED = { form: { email: '', password: '', confirm: '' } };

/** A second check on the email field: the array runs in order and all of it runs. */
const WITH_EMAIL: Spec = {
  root: 'screen',
  elements: {
    ...SPEC.elements,
    email: {
      type: 'TextInput',
      props: {
        label: 'Email',
        value: { $bindState: '/form/email' },
        placeholder: 'you@company.com',
        help: null,
        required: true,
        checks: [
          { type: 'required', args: null, message: 'Email is required' },
          { type: 'email', args: null, message: 'That is not a valid email' },
        ],
      },
      children: [],
    },
  },
};

/** …plus the first check that carries args. */
const WITH_MINLENGTH: Spec = {
  root: 'screen',
  elements: {
    ...WITH_EMAIL.elements,
    pw: {
      type: 'TextInput',
      props: {
        label: 'Password',
        value: { $bindState: '/form/password' },
        placeholder: null,
        help: 'At least 8 characters.',
        required: true,
        checks: [
          { type: 'required', args: null, message: 'Password is required' },
          { type: 'minLength', args: { min: 8 }, message: 'At least 8 characters' },
        ],
      },
      children: [],
    },
  },
};

/** …plus a cross-field check that reads the other value through $state. */
const WITH_MATCH: Spec = {
  root: 'screen',
  elements: {
    ...WITH_MINLENGTH.elements,
    pw2: {
      type: 'TextInput',
      props: {
        label: 'Confirm password',
        value: { $bindState: '/form/confirm' },
        placeholder: null,
        help: null,
        required: true,
        checks: [
          { type: 'matches', args: { other: { $state: '/form/password' } }, message: 'Passwords do not match' },
        ],
      },
      children: [],
    },
  },
};

export const VALIDATION_TASKS: Task[] = [
  {
    id: 'blur',
    goal: (
      <>
        Type one character into <strong>Email</strong>, delete it, then click away. The error appears only on blur —
        the <code>checks</code> array is data the component chose to run, at a moment the component chose.
      </>
    ),
    hint: 'Rule: nothing in the spec says when to validate. Look at TextInput in the your app code tab: it passes validateOn: "blur" to useFieldValidation and calls validate() from onBlur.',
    steps: [
      <>
        In <strong>rendered output</strong>, click into the <strong>Email</strong> field and type one character.
        Nothing turns red.
      </>,
      <>
        Delete it again, then click anywhere outside the field. Only now does{' '}
        <strong>Email is required</strong> appear in red underneath.
      </>,
      <>
        Open the <strong>spec json</strong> tab: the <code>email</code> element carries <code>checks</code> as an
        ordinary prop, beside <code>label</code> and <code>value</code>. There is no <code>validation</code> field on
        an element.
      </>,
      <>
        Click the <strong>your app code</strong> tab and read its first block, <code>TextInput</code>:{' '}
        <code>validateOn: 'blur'</code> and an <code>onBlur</code> that calls{' '}
        <code>validation.touch()</code> then <code>validation.validate()</code>. The component picked the moment.
      </>,
      <>
        Click the <strong>log</strong> tab: one <code>write /form/email</code> line per keystroke, and nothing at all
        logged for the validation itself.
      </>,
    ],
    check: ({ written }) => written.includes('/form/email'),
  },
  {
    id: 'email-check',
    goal: (
      <>
        Reject <code>not-an-email</code> too by adding a second check to the email field. Checks are an array and all
        of them run — <code>required</code> alone is happy with any non-empty string.
      </>
    ),
    hint: 'Rule: a check is { type, args, message }; args is null for checks that take none. Append { "type": "email", "args": null, "message": "That is not a valid email" } to email.props.checks.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and find the <code>email</code> element&rsquo;s <code>checks</code>{' '}
        array.
      </>,
      <>
        Put a comma after the <code>required</code> entry and add a second one:{' '}
        <code>{'{ "type": "email", "args": null, "message": "That is not a valid email" }'}</code>.
      </>,
      <>
        In <strong>rendered output</strong>, type <code>not-an-email</code> into <strong>Email</strong> and click
        away.
      </>,
      <>
        Read under the field: <strong>That is not a valid email</strong>, in red. The <code>required</code> check
        passed and the second one did not.
      </>,
    ],
    solution: {
      spec: WITH_EMAIL,
      note: 'checks is an array and every entry runs, so required and email report independently against the same value.',
    },
    check: ({ spec }) =>
      Boolean(deepFind(spec?.elements?.email?.props ?? {}, (n) => n.type === 'email')),
  },
  {
    id: 'minlength',
    goal: (
      <>
        Enforce the password help text: eight characters minimum. This is the first check that needs{' '}
        <code>args</code>, and the arg names are fixed by the built-in check, not by you.
      </>
    ),
    hint: 'Rule: minLength takes { "min": n }, maxLength takes { "max": n }, pattern takes { "pattern": "…" }. Append { "type": "minLength", "args": { "min": 8 }, "message": "At least 8 characters" } to pw.props.checks.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and find the <code>pw</code> element&rsquo;s <code>checks</code>{' '}
        array.
      </>,
      <>
        Append a second entry:{' '}
        <code>{'{ "type": "minLength", "args": { "min": 8 }, "message": "At least 8 characters" }'}</code> — the arg
        is named <code>min</code> because the built-in check says so.
      </>,
      <>
        In <strong>rendered output</strong>, type <code>short</code> into <strong>Password</strong> and click away.
      </>,
      <>
        Read under the field: <strong>At least 8 characters</strong> in red. Add three more characters and blur
        again — it clears.
      </>,
    ],
    solution: {
      spec: WITH_MINLENGTH,
      note: 'args carries the parameters of the built-in check, under the names it expects: min for minLength, max for maxLength, pattern for pattern.',
    },
    check: ({ spec }) =>
      Boolean(
        deepFind(spec?.elements?.pw?.props ?? {}, (n) => n.type === 'minLength' && Boolean(n.args)),
      ),
  },
  {
    id: 'crossfield',
    goal: (
      <>
        Make <strong>Confirm password</strong> compare itself to the password field. A cross-field check reaches the
        other value through a <code>$state</code> expression, resolved when the check runs.
      </>
    ),
    hint: 'Rule: matches, equalTo, lessThan, greaterThan and requiredIf all take { "other": { "$state": "/path" } }. Set pw2.props.checks to [{ "type": "matches", "args": { "other": { "$state": "/form/password" } }, "message": "Passwords do not match" }] — then edit the password afterwards and note the confirm field does NOT re-check itself.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and find <code>"checks": null</code> on the <code>pw2</code> element.
      </>,
      <>
        Replace the <code>null</code> with{' '}
        <code>
          {'[{ "type": "matches", "args": { "other": { "$state": "/form/password" } }, "message": "Passwords do not match" }]'}
        </code>
        .
      </>,
      <>
        In <strong>rendered output</strong>, type <code>hunter2xyz</code> into <strong>Password</strong>, then{' '}
        <code>nope</code> into <strong>Confirm password</strong>, and click away.
      </>,
      <>
        Read under the confirm field: <strong>Passwords do not match</strong> in red — the check resolved{' '}
        <code>/form/password</code> out of the live state model at that moment.
      </>,
      <>
        Now change <strong>Password</strong> to something else and click away: the confirm field keeps its old
        verdict. A check only re-runs when <em>its own</em> field is validated.
      </>,
    ],
    solution: {
      spec: WITH_MATCH,
      note: 'args.other is an expression, resolved against the live state model when the check runs — which is why it is cross-field and why it is one-directional.',
    },
    check: ({ spec }) =>
      Boolean(
        deepFind(spec?.elements?.pw2?.props ?? {}, (n) => n.type === 'matches' || n.type === 'equalTo'),
      ),
  },
  {
    id: 'validateform',
    goal: (
      <>
        Leave the form invalid and press <strong>Create account</strong>. <code>validateForm</code> writes its verdict
        to <code>/result</code> — find it in the <strong>state</strong> tab.
      </>
    ),
    hint: 'Rule: validateForm writes { valid, errors } to params.statePath, defaulting to /formValidation. Only fields that called useFieldValidation are in errors, so an unmounted or unbound control is invisible to it.',
    steps: [
      <>
        In <strong>rendered output</strong>, empty the <strong>Email</strong> field so the form is definitely
        invalid.
      </>,
      <>
        Press <strong>Create account</strong> in the card&rsquo;s grey footer bar.
      </>,
      <>
        Every field turns red at once — <code>validateForm</code> validated all of them, not just the one you
        touched.
      </>,
      <>
        Click the <strong>state</strong> tab: a new <code>result</code> object sits beside <code>form</code>, with{' '}
        <code>"valid": false</code> and an <code>errors</code> map keyed by binding path.
      </>,
    ],
    check: ({ state }) => typeof at(state, '/result') === 'object' && at(state, '/result') !== null,
  },
  {
    id: 'failopen',
    goal: (
      <>
        Now read the <strong>log</strong>. <code>submit</code> fired anyway, on an invalid form —{' '}
        <code>validateForm</code> reports, it never blocks, and it is the second binding in the array that had to
        care.
      </>
    ),
    hint: 'Rule: an array of bindings runs in order, each awaited, and nothing in it can stop the rest. To actually gate the submit, give it visible or move the decision into your own handler — and re-validate on the server either way.',
    steps: [
      <>
        Press <strong>Create account</strong> once more with the form still invalid.
      </>,
      <>
        Click the <strong>log</strong> tab. Newest is at the top: <code>action submit()</code> sits{' '}
        <em>above</em> <code>write /result = {'{"valid":false,…}'}</code>, so it ran second — after the verdict.
      </>,
      <>
        Open the <strong>spec json</strong> tab and read <code>submit.on.press</code>: an array of two bindings, run
        in order, each awaited.
      </>,
      <>
        Click the <strong>state</strong> tab: <code>/result/valid</code> is <code>false</code> and the submit
        happened regardless. Nothing in the array can stop the rest of it.
      </>,
    ],
    check: ({ fired, state }) => fired.includes('submit') && at(state, '/result/valid') === false,
  },
];

/**
 * The host side of validation, for the `your app code` pane.
 *
 * Validation has no field in the spec schema, so "where does this actually
 * live" is a harder question here than anywhere else in the library: the
 * checks are a prop, the registration is a hook call inside the component, the
 * fourteen implementations are a plain object in core, and `validateForm`
 * reaches all of it through context. That is four files and no obvious entry
 * point — hence this pane.
 */
const VALIDATION_WIRING: WiringBlock[] = [
  {
    label: 'lib/demo/components.tsx · TextInput',
    code: IMPL_ENTRIES.TextInput ?? '',
    note: (
      <>
        <strong>This is the registration.</strong> The component calls <code>useFieldValidation</code> with the
        binding path and its <code>checks</code> prop. A control that never calls it is invisible to{' '}
        <code>validateForm</code> — which is why validation is a property of the control, not of the tree.
      </>
    ),
  },
  {
    label: '@json-render/react · useFieldValidation',
    block: 'useFieldValidation',
    internal: true,
    note: (
      <>
        What that call does: registers the field in <code>ValidationProvider</code> under its path, and hands back{' '}
        <code>validate</code>, <code>touch</code> and the current errors.
      </>
    ),
  },
  {
    label: '@json-render/react · ValidationProvider.validateAll',
    block: 'ValidationProvider.validateAll',
    internal: true,
    note: (
      <>
        What <code>validateForm</code> calls. It walks the fields that registered themselves — so a hidden field,
        being unmounted, is simply not in the list.
      </>
    ),
  },
  {
    label: '@json-render/core · runValidation / runValidationCheck',
    block: 'runValidation',
    internal: true,
    note: <>One field, one config, in order. The first failing check wins.</>,
  },
  {
    label: '@json-render/core · runValidationCheck',
    block: 'runValidationCheck',
    internal: true,
    note: (
      <>
        The fail-open path is here: an unknown check type has no function to call, so it returns valid. That is why
        a check a model invented validates clean forever.
      </>
    ),
  },
  {
    label: '@json-render/core · builtInValidationFunctions',
    block: 'builtInValidationFunctions',
    internal: true,
    note: (
      <>
        All fourteen, implemented. <code>matches</code>, <code>equalTo</code>, <code>lessThan</code>,{' '}
        <code>greaterThan</code> and <code>requiredIf</code> read their <code>args.other</code> from the live
        state model — that is the whole cross-field mechanism.
      </>
    ),
  },
];

/**
 * Six stages over four snapshots, cumulative: every stage arrives at what the
 * one before it finished with, so no stage asks for an edit that is already in
 * the spec it loaded. Stages one, five and six change nothing — the first only
 * looks, the last two only press — which is why SPEC and WITH_MATCH each serve
 * two stages.
 */
const VALIDATION_STAGES = stagesFromTasks(
  VALIDATION_TASKS,
  [
    {
      title: 'A check runs on blur',
      when:
        'In any control whose value can be wrong and that form-level validation must see, because registering is the only thing that puts a field in `validateAll()`. Not in a display component, and not with any expectation that `validateOn` schedules anything: that string is documentation, so you choose the moment yourself by calling `validate()` from your own onBlur, onChange or submit.',
      concept: 'use-field-validation',
      ref: 'val-usefieldvalidation',
      refs: ['hook-usefieldvalidation'],
      // 'log': the last step reads the per-keystroke writes there, and the
      // absence of any line for the validation itself.
      panes: ['spec', 'wiring', 'log'],
      spec: SPEC,
    },
    {
      title: 'checks is an ordinary prop',
      when:
        'Use a built-in check type wherever one fits and register a `validationFunction` on the provider where none does. What you must not do is invent a type name: an unrecognised type is reported VALID, so the field validates clean forever — and that is exactly what a generated spec produces, so whitelist the check types you accept before trusting one.',
      concept: 'checks-prop',
      also: ['unknown-check-silent'],
      ref: 'val-email',
      refs: ['val-required', 'val-url', 'val-numeric', 'val-helpers'],
      panes: ['spec', 'wiring'],
      // Stage one changes nothing, so this stage arrives where it left off —
      // the email check is what the learner adds HERE.
      spec: SPEC,
    },
    {
      title: 'Checks that carry args',
      when:
        'When the rule is the same function with a different bound — `minLength` at 8 here and 2 there — args keep one registered function serving every field. Reach past it for a `validationFunction` of your own as soon as the rule needs more than the value and its args object; anything that reads a second field belongs in the cross-field checks, and anything that reads the server does not belong in a check at all.',
      ref: 'val-minlength',
      refs: ['val-maxlength', 'val-min', 'val-max', 'val-pattern'],
      panes: ['spec', 'wiring'],
      summary:
        'A check is `{ type, …args }`, so the same registered function serves every field that needs it — `minLength` with `{ "min": 8 }` here and `{ "min": 2 }` elsewhere. The args reach your function as its second parameter.',
      spec: WITH_EMAIL,
    },
    {
      title: 'Reading the other field',
      when:
        'Confirm-password and date-range pairs, where the args go through `resolvePropValue` so `{ "$state": "/form/password" }` reads the live value. Its weakness decides how far you can trust it: the check runs on ITS OWN field’s events, so editing the other field leaves the verdict stale. Where that matters, re-run everything with `validateForm` at submit rather than believing what is on screen.',
      concept: 'cross-field-check',
      ref: 'val-matches',
      refs: ['val-equalto', 'val-lessthan', 'val-greaterthan', 'val-requiredif'],
      panes: ['spec', 'state'],
      spec: WITH_MINLENGTH,
    },
    {
      title: 'What validateForm writes',
      when:
        'This is the shape your UI should read — a summary banner, a per-field list — since `errors` is keyed by the path each control registered, usually its `$bindState` path. Give every form its own `statePath`: the default `/formValidation` is a single global slot, so two forms on one page overwrite each other’s verdict.',
      concept: 'validate-form-reports',
      ref: 'val-result',
      panes: ['state', 'log'],
      spec: WITH_MATCH,
    },
    {
      title: 'It reports, it never blocks',
      when:
        'Never rely on this as a gate. Nothing in an array of bindings can stop the ones after it, so `validateForm` then `submit` submits an invalid form; the decision has to live in your own handler, which reads the written `valid` before doing the work — and then on the server, which is the only place it cannot be bypassed.',
      ref: 'act-validateform',
      // 'spec': the middle step reads submit.on.press to see the array of two
      // bindings that the log has just shown running in order.
      panes: ['log', 'state', 'spec'],
      summary:
        'An action’s array of bindings runs in order and each one is awaited, but nothing in it can stop the rest — `validateForm` writes its verdict and `submit` fires regardless. Gating is your job: a `visible` condition, or the decision moved into your own handler. Re-validate on the server either way.',
      spec: WITH_MATCH,
    },
  ],
  VALIDATION_LAB_SEED,
);

export function ValidationLab() {
  return (
    <SpecPlayground
      spec={SPEC}
      seedState={VALIDATION_LAB_SEED}
      // The playground opens on panes[0] of THIS list, not of the stage it
      // lands on, so the first entry has to be a pane stage one actually shows
      // — otherwise arriving at the lab highlights no tab at all.
      panes={['spec', 'tree', 'state', 'log', 'wiring', 'catalog', 'impl']}
      wiring={VALIDATION_WIRING}
      height={540}
      stages={VALIDATION_STAGES}
      labSlug="validation"
      hint={
        <>
          Checks travel as an ordinary <code>checks</code> prop. The component registers them with{' '}
          <code>useFieldValidation</code> — there is no <code>validation</code> field in the spec schema.
        </>
      }
    />
  );
}
