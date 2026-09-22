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
  },

  // Required by the type even when empty. Leave it out and `defineCatalog`
  // does not compile. An empty map also keeps `actions` OPTIONAL in
  // defineRegistry — the moment you add an entry here it becomes required.
  actions: {},
});
