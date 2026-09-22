import type { Spec } from '@json-render/core';
import type { ReferenceEntry } from './types';

/**
 * Validation. Verified against `builtInValidationFunctions`, `runValidation`
 * and `check` in node_modules/@json-render/core/dist/index.mjs (lines 642-830)
 * and `ValidationProvider` / `useFieldValidation` in the react dist.
 *
 * All fourteen built-in names, in source order:
 *   required email minLength maxLength pattern min max
 *   numeric url matches equalTo lessThan greaterThan requiredIf
 */

/** Every example on this page hangs off the same small form. */
function formSpec(checks: Array<Record<string, unknown>>, label: string, path: string, extra?: Record<string, unknown>): Spec {
  return {
    root: 'screen',
    elements: {
      screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['field', 'go', 'out'] },
      field: {
        type: 'TextInput',
        props: { label, value: { $bindState: path }, placeholder: 'type, then click away', help: 'validates on blur', required: null, checks, ...extra },
        children: [],
      },
      go: {
        type: 'Button',
        props: { label: 'validateForm', variant: 'primary' },
        children: [],
        on: { press: { action: 'validateForm', params: { statePath: '/result' } } },
      },
      out: { type: 'Text', props: { value: { $template: 'valid = ${/result/valid}' }, tone: null, size: 'sm' }, children: [] },
    },
  } as Spec;
}

export const VALIDATION_ENTRIES: ReferenceEntry[] = [
  {
    id: 'val-required',
    category: 'Validation',
    name: 'required',
    signature: `{ "type": "required", "message": "This field is required" }`,
    summary: 'Value must not be null, undefined, an empty string, or an empty array.',
    details: [
      'Strings are TRIMMED first, so "   " fails.',
      'Arrays fail when empty. Every other type — including `0` and `false` — passes.',
      'Takes no args. `check.required()` builds it with the default message "This field is required".',
      'Validation is not a spec field. It travels as an ordinary prop, and the component registers it with `useFieldValidation`.',
    ],
    example: {
      spec: formSpec([{ type: 'required', args: null, message: 'This field is required' }], 'Name', '/form/name'),
      seed: { form: { name: '' }, result: { valid: null } },
    },
    related: ['val-requiredif', 'val-helpers', 'hook-usefieldvalidation', 'act-validateform'],
    step: 'validation',
    tags: ['required', 'check'],
  },
  {
    id: 'val-email',
    category: 'Validation',
    name: 'email',
    signature: `{ "type": "email", "message": "Invalid email address" }`,
    summary: 'Value must be a string matching /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.',
    details: [
      'That regex is the whole implementation — it accepts `a@b.c` and rejects nothing else worth mentioning.',
      'A non-string value fails, so an empty field also fails. Pair it with `required` only if you want two messages.',
      'It does NOT pass an empty string. If the field is optional, gate it with `enabled`.',
    ],
    example: {
      spec: formSpec([{ type: 'email', args: null, message: 'That is not an email address' }], 'Email', '/form/email'),
      seed: { form: { email: '' }, result: { valid: null } },
    },
    related: ['val-url', 'val-pattern', 'val-helpers'],
    step: 'validation',
    tags: ['email', 'check'],
  },
  {
    id: 'val-url',
    category: 'Validation',
    name: 'url',
    signature: `{ "type": "url", "message": "Invalid URL" }`,
    summary: 'Value must be a string the URL constructor accepts.',
    details: [
      'Implemented as `try { new URL(value); return true } catch { return false }`.',
      'That means a scheme is REQUIRED: "example.com" fails, "https://example.com" passes, and so does "mailto:a@b.c".',
      'A non-string fails.',
    ],
    example: {
      spec: formSpec([{ type: 'url', args: null, message: 'Needs a scheme, e.g. https://' }], 'Website', '/form/site'),
      seed: { form: { site: 'example.com' }, result: { valid: null } },
      note: 'The seed value has no scheme, so it fails. Add https:// and blur to see it pass.',
    },
    related: ['val-email', 'val-pattern'],
    step: 'validation',
    tags: ['url', 'check'],
  },
  {
    id: 'val-numeric',
    category: 'Validation',
    name: 'numeric',
    signature: `{ "type": "numeric", "message": "Must be a number" }`,
    summary: 'Value is a number (not NaN) or a string that parseFloat can read.',
    details: [
      '`parseFloat` is lenient: "12abc" PASSES, because parseFloat stops at the first non-numeric character.',
      'An empty string fails; `NaN` fails; booleans, objects and arrays fail.',
      'Use `pattern` with `^\\d+$` when you need strictness.',
    ],
    example: {
      spec: formSpec([{ type: 'numeric', args: null, message: 'Must be a number' }], 'Amount', '/form/amount'),
      seed: { form: { amount: '12abc' }, result: { valid: null } },
      note: 'The seed is "12abc" and it passes. That is parseFloat, not a bug.',
    },
    related: ['val-min', 'val-max', 'val-pattern'],
    step: 'validation',
    tags: ['numeric', 'check'],
  },
  {
    id: 'val-minlength',
    category: 'Validation',
    name: 'minLength',
    signature: `{ "type": "minLength", "args": { "min": 8 }, "message": "Must be at least 8 characters" }`,
    summary: 'String length >= args.min.',
    details: [
      'A non-string value fails. A missing or non-number `args.min` fails too — the check returns false rather than passing.',
      'Length is UTF-16 code units, so emoji and combining characters count as more than one.',
      'No trimming: leading spaces count.',
      '`check.minLength(8)` builds it, with the message "Must be at least 8 characters".',
    ],
    example: {
      spec: formSpec([{ type: 'minLength', args: { min: 8 }, message: 'At least 8 characters' }], 'Password', '/form/password'),
      seed: { form: { password: 'short' }, result: { valid: null } },
    },
    related: ['val-maxlength', 'val-pattern', 'val-helpers'],
    step: 'validation',
    tags: ['minLength', 'check'],
  },
  {
    id: 'val-maxlength',
    category: 'Validation',
    name: 'maxLength',
    signature: `{ "type": "maxLength", "args": { "max": 20 }, "message": "Must be at most 20 characters" }`,
    summary: 'String length <= args.max.',
    details: [
      'A non-string fails — including `undefined`, so an untouched field is "too long" as far as this check is concerned.',
      'Missing `args.max` fails.',
      'Pair with `required` so the empty case reports the message you actually mean.',
    ],
    example: {
      spec: formSpec([{ type: 'maxLength', args: { max: 10 }, message: 'At most 10 characters' }], 'Code', '/form/code'),
      seed: { form: { code: 'this is far too long' }, result: { valid: null } },
    },
    related: ['val-minlength', 'val-required'],
    step: 'validation',
    tags: ['maxLength', 'check'],
  },
  {
    id: 'val-min',
    category: 'Validation',
    name: 'min',
    signature: `{ "type": "min", "args": { "min": 1 }, "message": "Must be at least 1" }`,
    summary: 'Numeric >=. The value must ALREADY be a number.',
    details: [
      '`typeof value !== "number"` fails immediately — a text input gives you a STRING, so "5" fails `min: 1`.',
      'This is the single most surprising validation in the library: `numeric` accepts "12abc" but `min` rejects "12".',
      'Coerce in your component before writing to state, or validate with `pattern`.',
      'Missing `args.min` fails.',
    ],
    example: {
      spec: formSpec([{ type: 'min', args: { min: 1 }, message: 'Must be at least 1' }], 'Quantity (a text field)', '/form/qty'),
      seed: { form: { qty: '5' }, result: { valid: null } },
      note: 'The value is the string "5". It fails min: 1, because 5 was never a number.',
    },
    related: ['val-max', 'val-numeric', 'val-greaterthan'],
    step: 'validation',
    tags: ['min', 'numeric', 'gotcha'],
  },
  {
    id: 'val-max',
    category: 'Validation',
    name: 'max',
    signature: `{ "type": "max", "args": { "max": 99 }, "message": "Must be at most 99" }`,
    summary: 'Numeric <=. Same strict typing as min.',
    details: [
      'A non-number value fails, so a string from a text input never passes.',
      'Missing `args.max` fails.',
      '`check.max(99)` builds it with "Must be at most 99".',
    ],
    example: {
      spec: formSpec([{ type: 'max', args: { max: 99 }, message: 'Must be at most 99' }], 'Percent', '/form/pct'),
      seed: { form: { pct: 120 }, result: { valid: null } },
      note: 'The seed is the NUMBER 120, so the check runs and fails. Type into the field and it becomes a string, which fails for a different reason.',
    },
    related: ['val-min', 'val-numeric'],
    step: 'validation',
    tags: ['max', 'numeric'],
  },
  {
    id: 'val-pattern',
    category: 'Validation',
    name: 'pattern',
    signature: `{ "type": "pattern", "args": { "pattern": "^[A-Z]{2}\\\\d{9}$" }, "message": "Invalid format" }`,
    summary: 'String tested against a regex built from args.pattern.',
    details: [
      '`new RegExp(pattern)` with no flags. Case-insensitive matching needs `(?i)`-free workarounds — write the character classes out.',
      'An INVALID regex does not throw: the try/catch returns false, so every value fails and the message never explains why.',
      'The pattern is not anchored for you. Without `^…$` it matches anywhere in the string.',
      'Remember it travels through JSON, so backslashes are doubled in the spec.',
    ],
    example: {
      spec: formSpec([{ type: 'pattern', args: { pattern: '^[A-Z]{2}[0-9]{9}$' }, message: 'Format: two letters then nine digits' }], 'VAT number', '/form/vat'),
      seed: { form: { vat: 'FI12345678' }, result: { valid: null } },
      note: 'Eight digits, not nine. Add one and blur.',
    },
    related: ['val-email', 'val-url', 'val-numeric'],
    step: 'validation',
    tags: ['pattern', 'regex'],
  },
  {
    id: 'val-matches',
    category: 'Validation',
    name: 'matches',
    signature: `{ "type": "matches", "args": { "other": { "$state": "/form/password" } }, "message": "Fields must match" }`,
    summary: 'Cross-field equality. args.other is resolved against state before comparison.',
    details: [
      '`args` values go through `resolvePropValue`, so `{ "$state": "/path" }` is the normal way to point at another field.',
      '`matches` and `equalTo` are the SAME function — `equalTo: matchesImpl` in the source. Pick whichever reads better.',
      'A literal `other` works too: `args: { other: "yes" }`.',
      '`check.matches("/form/password")` wraps the path in `{ $state }` for you.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['p', 'c', 'go', 'out'] },
          p: { type: 'TextInput', props: { label: 'Password', value: { $bindState: '/form/password' }, placeholder: null, help: null, required: null, checks: null }, children: [] },
          c: {
            type: 'TextInput',
            props: {
              label: 'Confirm password',
              value: { $bindState: '/form/confirm' },
              placeholder: null,
              help: 'blur to check',
              required: null,
              checks: [{ type: 'matches', args: { other: { $state: '/form/password' } }, message: 'Passwords must match' }],
            },
            children: [],
          },
          go: { type: 'Button', props: { label: 'validateForm', variant: 'primary' }, children: [], on: { press: { action: 'validateForm', params: { statePath: '/result' } } } },
          out: { type: 'Text', props: { value: { $template: 'valid = ${/result/valid}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { password: 'hunter2', confirm: '' }, result: { valid: null } },
    },
    related: ['val-equalto', 'val-helpers', 'val-usefieldvalidation'],
    step: 'validation',
    tags: ['matches', 'cross-field'],
  },
  {
    id: 'val-equalto',
    category: 'Validation',
    name: 'equalTo',
    signature: `{ "type": "equalTo", "args": { "other": { "$state": "/form/email" } }, "message": "Fields must match" }`,
    summary: 'An alias for matches, with a name that reads better for confirmation fields.',
    details: [
      'Literally the same function object in the built-ins map: `matches: matchesImpl, equalTo: matchesImpl`.',
      'Default message from `check.equalTo()` is also "Fields must match".',
      'Nothing distinguishes them at runtime, in error output, or in the prompt.',
    ],
    example: {
      spec: formSpec([{ type: 'equalTo', args: { other: 'yes' }, message: 'Type exactly: yes' }], 'Type "yes" to confirm', '/form/confirm'),
      seed: { form: { confirm: 'no' }, result: { valid: null } },
      note: 'args.other can be a literal, not only a { $state } reference.',
    },
    related: ['val-matches', 'val-helpers'],
    step: 'validation',
    tags: ['equalTo', 'alias'],
  },
  {
    id: 'val-lessthan',
    category: 'Validation',
    name: 'lessThan',
    signature: `{ "type": "lessThan", "args": { "other": { "$state": "/form/end" } }, "message": "Must be before the end date" }`,
    summary: 'Value < other, with three comparison strategies: number, string, then numeric coercion.',
    details: [
      'number vs number → `<`. string vs string → lexicographic `<`, which is why ISO dates compare correctly.',
      'Otherwise both sides go through `Number()`, and the comparison runs if neither is NaN. So "3" < 5 is TRUE here — unlike `min`, this check coerces.',
      'Null, undefined and the empty string on EITHER side return false.',
      '`check.lessThan(path)` default message: "Must be less than the compared field".',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['start', 'end', 'go', 'out'] },
          start: {
            type: 'TextInput',
            props: {
              label: 'Start (ISO date)',
              value: { $bindState: '/form/start' },
              placeholder: '2026-01-01',
              help: 'must be before end',
              required: null,
              checks: [{ type: 'lessThan', args: { other: { $state: '/form/end' } }, message: 'Start must be before end' }],
            },
            children: [],
          },
          end: { type: 'TextInput', props: { label: 'End (ISO date)', value: { $bindState: '/form/end' }, placeholder: '2026-12-31', help: null, required: null, checks: null }, children: [] },
          go: { type: 'Button', props: { label: 'validateForm', variant: 'primary' }, children: [], on: { press: { action: 'validateForm', params: { statePath: '/result' } } } },
          out: { type: 'Text', props: { value: { $template: 'valid = ${/result/valid}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { start: '2026-12-31', end: '2026-01-01' }, result: { valid: null } },
      note: 'The seeded dates are the wrong way round. Blur the start field to see the error, then swap them.',
    },
    related: ['val-greaterthan', 'val-min', 'val-helpers'],
    step: 'validation',
    tags: ['lessThan', 'cross-field', 'dates'],
  },
  {
    id: 'val-greaterthan',
    category: 'Validation',
    name: 'greaterThan',
    signature: `{ "type": "greaterThan", "args": { "other": { "$state": "/form/min" } }, "message": "Must be greater" }`,
    summary: 'Value > other. Mirror image of lessThan, same three strategies.',
    details: [
      'number/number, string/string, then `Number()` coercion on both sides.',
      'Empty string, null or undefined on either side → false.',
      'Because it coerces, "7" > 5 passes here while `min: 5` on the same value fails.',
    ],
    example: {
      spec: formSpec([{ type: 'greaterThan', args: { other: { $state: '/form/floor' } }, message: 'Must be greater than the floor' }], 'Bid (string, coerced)', '/form/bid'),
      seed: { form: { bid: '3', floor: 5 }, result: { valid: null } },
      note: 'The bid is the STRING "3" and the floor is the NUMBER 5. greaterThan coerces both, so it compares 3 > 5 and fails. `max`/`min` would have rejected the string outright.',
    },
    related: ['val-lessthan', 'val-max'],
    step: 'validation',
    tags: ['greaterThan', 'cross-field'],
  },
  {
    id: 'val-requiredif',
    category: 'Validation',
    name: 'requiredIf',
    signature: `{ "type": "requiredIf", "args": { "field": { "$state": "/form/hasCompany" } }, "message": "Required for companies" }`,
    summary: 'Required only when args.field is truthy. Note the arg is named "field" but holds a VALUE.',
    details: [
      '`args.field` is resolved first, then tested with plain JS truthiness — `0`, `false`, `""`, `null` and `undefined` all mean "not required".',
      'When the condition is falsy the check returns TRUE immediately, whatever the value is.',
      'When it is truthy the check is identical to `required`: trimmed strings, non-empty arrays.',
      '`check.requiredIf("/form/hasCompany")` wraps the path in `{ $state }` for you, so the arg name is misleading twice over.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['flag', 'vat', 'go', 'out'] },
          flag: { type: 'Checkbox', props: { label: 'I am registering a company', checked: { $bindState: '/form/isCompany' } }, children: [] },
          vat: {
            type: 'TextInput',
            props: {
              label: 'VAT number',
              value: { $bindState: '/form/vat' },
              placeholder: null,
              help: 'required only when the box is ticked',
              required: null,
              checks: [{ type: 'requiredIf', args: { field: { $state: '/form/isCompany' } }, message: 'VAT number is required for companies' }],
            },
            children: [],
          },
          go: { type: 'Button', props: { label: 'validateForm', variant: 'primary' }, children: [], on: { press: { action: 'validateForm', params: { statePath: '/result' } } } },
          out: { type: 'Text', props: { value: { $template: 'valid = ${/result/valid}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { isCompany: false, vat: '' }, result: { valid: null } },
    },
    related: ['val-required', 'val-helpers'],
    step: 'validation',
    tags: ['requiredIf', 'conditional'],
  },
  {
    id: 'val-helpers',
    category: 'Validation',
    name: 'check.* helpers',
    signature: `import { check } from "@json-render/core";

check.required()                  // { type: "required", message: "This field is required" }
check.minLength(8)                // { type: "minLength", args: { min: 8 }, message: "Must be at least 8 characters" }
check.matches("/form/password")   // { type: "matches", args: { other: { $state: "/form/password" } }, … }`,
    lang: 'typescript',
    summary: 'Typed builders for the fourteen built-in checks, each with a default English message.',
    details: [
      'Full set: required, email, minLength, maxLength, pattern, min, max, url, numeric, matches, equalTo, lessThan, greaterThan, requiredIf.',
      'Every builder takes an optional `message` as its last argument.',
      'The four cross-field builders wrap their path argument in `{ $state: path }` automatically.',
      'An UNKNOWN check type does not fail the field: `runValidationCheck` logs `Unknown validation function: <type>` and returns `valid: true`.',
      'Register extra functions with `JSONUIProvider validationFunctions={{ … }}`; they are looked up after the built-ins.',
    ],
    run: {
      label: 'ValidationConfig',
      input: JSON.stringify(
        {
          checks: [
            { type: 'required', message: 'Required' },
            { type: 'minLength', args: { min: 8 }, message: 'At least 8 characters' },
            { type: 'notARealCheck', message: 'Never fires' },
          ],
        },
        null,
        2,
      ),
      labelB: 'context { value, stateModel }',
      input2: JSON.stringify({ value: 'short', stateModel: {} }, null, 2),
      fn: 'runValidation',
    },
    related: ['val-required', 'val-usefieldvalidation', 'val-result'],
    step: 'validation',
    tags: ['check', 'helpers', 'builders'],
  },
  {
    id: 'val-usefieldvalidation',
    category: 'Validation',
    name: 'ValidationConfig',
    signature: `interface ValidationConfig {
  checks?: ValidationCheck[];
  validateOn?: "change" | "blur" | "submit";
  enabled?: VisibilityCondition;
}`,
    lang: 'typescript',
    summary: 'What a component hands to useFieldValidation. Two of its three fields behave differently than you would guess.',
    details: [
      '`checks` is the array that actually runs, in order. Every failing check contributes its message to `errors`.',
      '`enabled` IS honoured by the core: `runValidation` evaluates it against state first and returns `{ valid: true, errors: [], checks: [] }` when falsy.',
      '`validateOn` is NOT honoured by the library. Nothing in core or react reads it — the only reference is an equality check used to decide whether to re-register the field.',
      'Your component owns the timing. The demo TextInput passes `validateOn: "blur"` and then calls `validate()` from its own onBlur — the string is documentation for the reader, not a switch.',
      'Registration is what makes `validateForm` able to see the field, so a control that never calls `useFieldValidation` is invisible to `validateAll()`.',
    ],
    related: ['hook-usefieldvalidation', 'act-validateform', 'val-result', 'prov-validationprovider'],
    step: 'validation',
    tags: ['ValidationConfig', 'validateOn', 'gotcha'],
  },
  {
    id: 'val-result',
    category: 'Validation',
    name: 'ValidationResult / validateForm output',
    signature: `interface ValidationResult {
  valid: boolean;
  errors: string[];
  checks: Array<{ type: string; valid: boolean; message: string }>;
}

// what the validateForm action writes to state:
{ "valid": boolean, "errors": { "<field path>": string[] } }`,
    lang: 'typescript',
    summary: 'Per-field result from runValidation, and the aggregate the validateForm action writes into state.',
    details: [
      '`checks` lists EVERY check including the ones that passed, so you can show per-rule state, not just messages.',
      'An unknown check type appears in `checks` with `valid: true`.',
      'The aggregate written by `validateForm` is keyed by the path each control registered — usually the `$bindState` path, so `/form/email`.',
      'Fields that are valid are omitted from `errors` entirely; an empty object means the form passed.',
      'It is written to `/formValidation` unless `params.statePath` says otherwise, and it is a nested object — reading it with `$template` gives "[object Object]".',
    ],
    run: {
      label: 'ValidationConfig',
      input: JSON.stringify(
        { checks: [{ type: 'email', message: 'Invalid email address' }, { type: 'minLength', args: { min: 5 }, message: 'Too short' }] },
        null,
        2,
      ),
      labelB: 'context { value, stateModel }',
      input2: JSON.stringify({ value: 'a@b', stateModel: {} }, null, 2),
      fn: 'runValidation',
    },
    related: ['act-validateform', 'val-usefieldvalidation', 'hook-usefieldvalidation'],
    step: 'validation',
    tags: ['ValidationResult', 'errors'],
  },
];
