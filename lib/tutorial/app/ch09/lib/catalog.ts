import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

/**
 * THE CATALOG. The contract between the JSON and your React.
 *
 * It is read twice: by TypeScript, to force every component to exist and to
 * type its props; and by `catalog.prompt()`, to describe your UI vocabulary
 * to a model. Nothing else in the app gets to invent a component name.
 */
export const catalog = defineCatalog(schema, {
  components: {
    Page: {
      description: 'Outermost screen container. Exactly one per spec, always the root element.',
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
      }),
      slots: ['default'],
      example: { title: 'Invoice review', subtitle: 'March 2026' },
    },

    Stack: {
      description: 'Flex box. Group two or more things with it — row or column, with a gap.',
      props: z.object({
        direction: z.enum(['row', 'column']),
        gap: z.enum(['sm', 'md', 'lg']),
      }),
      slots: ['default'],
      example: { direction: 'column', gap: 'md' },
    },

    Heading: {
      description: 'A section heading. Level "1" is the largest.',
      props: z.object({
        text: z.string(),
        level: z.enum(['1', '2', '3']),
      }),
      slots: [],
      example: { text: 'Outstanding', level: '2' },
    },

    Text: {
      description: 'One run of prose. Use it for every label, caption and sentence.',
      props: z.object({
        value: z.string(),
        tone: z.enum(['default', 'muted', 'danger']).nullable(),
      }),
      slots: [],
      example: { value: 'Three invoices need review.', tone: null },
    },

    Button: {
      description:
        'A button. It emits a "press" event — bind that event in the element\'s `on` field to run an action.',
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'ghost']),
      }),
      slots: [],
      example: { label: 'Mark paid', variant: 'primary' },
    },

    Badge: {
      description: 'Small status pill. Use it for an invoice status, never for prose.',
      props: z.object({
        label: z.string(),
        tone: z.enum(['neutral', 'success', 'warning', 'danger']),
      }),
      slots: [],
      example: { label: 'unpaid', tone: 'warning' },
    },

    TextField: {
      description:
        'Single-line text input. Bind `value` with $bindState so typing writes back to the state model.',
      props: z.object({
        label: z.string(),
        value: z.string().nullable(),
        placeholder: z.string().nullable(),
        // Validation is DATA. Each check names a function, carries its args
        // and its own message. Nothing here can block a submit on its own.
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
        label: 'Note',
        value: '',
        placeholder: 'Add a note',
        checks: [{ type: 'minLength', args: { min: 4 }, message: 'At least 4 characters.' }],
      },
    },

    Toggle: {
      description: 'A checkbox. Bind `checked` with $bindState to drive a filter or a mode.',
      props: z.object({
        label: z.string(),
        checked: z.boolean().nullable(),
      }),
      slots: [],
      example: { label: 'Unpaid only', checked: false },
    },
  },

  // An action is a NAME plus a params schema plus a sentence for the model.
  // It is not code. The code lives in the registry, and adding an entry here
  // makes `actions` REQUIRED in defineRegistry until you write it.
  actions: {
    markPaid: {
      description:
        'Mark one invoice as paid and save its note. Use it only on an invoice whose status is not already "paid".',
      params: z.object({
        id: z.string(),
        note: z.string().nullable(),
      }),
    },
  },
});
