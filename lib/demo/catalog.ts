import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

/**
 * THE CATALOG — the single source of truth for this playground.
 *
 * A catalog is two things at once, and that is the whole trick:
 *
 *   1. A *compile-time* contract. `defineRegistry(catalog, ...)` forces every
 *      component here to have an implementation, with props typed from the Zod
 *      schema below. Add a component here and the registry stops compiling
 *      until you implement it.
 *
 *   2. A *runtime* prompt. `catalog.prompt()` walks these Zod schemas and
 *      descriptions and produces the system prompt the model sees. The model
 *      never sees your React code — it sees this file, serialized.
 *
 * That is why `description` matters as much as `props`. The description is
 * documentation for a reader who cannot read your source: the model.
 *
 * Note on `.nullable()` vs `.optional()`: prefer `.nullable()`. Structured
 * output from most providers is happier emitting an explicit `null` than
 * omitting a key, and a nullable field survives a JSON round-trip unchanged.
 */

/** Tone is reused across several components, so the model learns one vocabulary. */
const tone = z.enum(['neutral', 'info', 'success', 'warning', 'danger']);

export const demoComponents = {
  Screen: {
    description:
      'Outermost page container. Use exactly one, as the spec root. Everything else nests inside it.',
    props: z.object({
      title: z.string().nullable(),
      subtitle: z.string().nullable(),
    }),
    slots: ['default'],
    example: { title: 'Dashboard', subtitle: 'Last 30 days' },
  },

  Stack: {
    description:
      'Flex layout box. The workhorse for grouping — use it whenever two or more things sit next to each other.',
    props: z.object({
      direction: z.enum(['row', 'column']),
      gap: z.enum(['none', 'sm', 'md', 'lg']),
      align: z.enum(['start', 'center', 'end', 'stretch']).nullable(),
      wrap: z.boolean().nullable(),
    }),
    slots: ['default'],
    example: { direction: 'column', gap: 'md', align: null, wrap: null },
  },

  Card: {
    description:
      'A bordered surface with an optional title. Has a named "footer" slot for actions, separate from its default children.',
    props: z.object({
      title: z.string().nullable(),
      subtitle: z.string().nullable(),
    }),
    slots: ['default', 'footer'],
    example: { title: 'Invoice', subtitle: null },
  },

  Heading: {
    description: 'A section heading. Level 1 is largest.',
    props: z.object({
      text: z.string(),
      level: z.enum(['1', '2', '3']),
    }),
    slots: [],
    example: { text: 'Overview', level: '2' },
  },

  Text: {
    description: 'A paragraph or inline run of text. Use for all prose.',
    props: z.object({
      value: z.string(),
      tone: tone.nullable(),
      size: z.enum(['sm', 'md', 'lg']).nullable(),
    }),
    slots: [],
    example: { value: 'Your balance is settled.', tone: null, size: null },
  },

  Badge: {
    description: 'A small status pill. Good for statuses, counts, and tags.',
    props: z.object({ label: z.string(), tone: tone.nullable() }),
    slots: [],
    example: { label: 'Paid', tone: 'success' },
  },

  Metric: {
    description: 'A single big number with a caption. Use for KPIs.',
    props: z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string().nullable(),
      tone: tone.nullable(),
    }),
    slots: [],
    example: { label: 'Revenue', value: '€48,200', delta: '+12%', tone: 'success' },
  },

  Alert: {
    description: 'A callout banner for a message the user must notice.',
    props: z.object({
      title: z.string(),
      message: z.string().nullable(),
      tone: tone.nullable(),
    }),
    slots: [],
    example: { title: 'Heads up', message: 'Two fields need review.', tone: 'warning' },
  },

  Button: {
    description:
      'A clickable button. Emits a "press" event — bind it in the element\'s `on` field to run an action.',
    props: z.object({
      label: z.string(),
      variant: z.enum(['primary', 'secondary', 'ghost', 'danger']).nullable(),
    }),
    slots: [],
    example: { label: 'Submit', variant: 'primary' },
  },

  TextInput: {
    description:
      'Single-line text field. Bind its `value` prop with {"$bindState": "/some/path"} to read and write state. Pass `checks` to validate it.',
    props: z.object({
      label: z.string(),
      value: z.unknown().nullable(),
      placeholder: z.string().nullable(),
      help: z.string().nullable(),
      required: z.boolean().nullable(),
      /**
       * Validation is NOT a spec-level field in json-render — the schema has no
       * `validation` slot on elements. It travels as an ordinary prop, and the
       * component is what registers it by calling `useFieldValidation`. That is
       * a deliberate design choice: validation belongs to the control that owns
       * the value, not to the tree.
       */
      checks: z
        .array(
          z.object({
            type: z.string(),
            args: z.record(z.string(), z.unknown()).nullable(),
            message: z.string(),
          }),
        )
        .nullable(),
    }),
    slots: [],
    example: {
      label: 'Email',
      value: { $bindState: '/form/email' },
      placeholder: 'you@co.com',
      help: null,
      required: true,
      checks: [{ type: 'email', args: null, message: 'Enter a valid email' }],
    },
  },

  Checkbox: {
    description: 'A boolean toggle. Bind its `checked` prop with {"$bindState": "/path"}.',
    props: z.object({
      label: z.string(),
      checked: z.unknown().nullable(),
    }),
    slots: [],
    example: { label: 'Subscribe', checked: { $bindState: '/form/subscribe' } },
  },

  Select: {
    description: 'A dropdown. Bind its `value` prop with {"$bindState": "/path"}.',
    props: z.object({
      label: z.string(),
      value: z.unknown().nullable(),
      options: z.array(z.object({ label: z.string(), value: z.string() })),
    }),
    slots: [],
    example: {
      label: 'Country',
      value: { $bindState: '/form/country' },
      options: [{ label: 'Finland', value: 'fi' }],
    },
  },

  Divider: {
    description: 'A horizontal rule between sections.',
    props: z.object({}),
    slots: [],
    example: {},
  },
};

export const demoActions = {
  submit: {
    description: 'Submit the form. Reads the whole state model; takes no params.',
    params: z.object({}),
  },
  notify: {
    description: 'Show a toast message to the user.',
    params: z.object({ message: z.string() }),
  },
  reset: {
    description: 'Clear the form back to its initial state.',
    params: z.object({}),
  },
};

export const demoCatalog = defineCatalog(schema, {
  components: demoComponents,
  actions: demoActions,
});

export type DemoComponentName = keyof typeof demoComponents;
