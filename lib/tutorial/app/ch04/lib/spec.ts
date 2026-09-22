import type { Spec } from '@json-render/core';

/**
 * THE SPEC. A flat map of keyed elements, not a nested tree.
 *
 * `root` names the entry element; every other element is reached only by
 * appearing in some element's `children`. Write it by hand today; a model
 * writes it later; a compiler writes it in the last chapter. Same shape.
 */
export const spec: Spec = {
  root: 'page',
  elements: {
    page: {
      type: 'Page',
      props: { title: 'Invoice review', subtitle: { $state: '/company' } },
      children: ['heading', 'summary'],
    },
    heading: {
      type: 'Heading',
      props: { text: 'Outstanding', level: '2' },
      children: [],
    },
    summary: {
      type: 'Stack',
      props: { direction: 'column', gap: 'sm' },
      children: ['line', 'hint'],
    },
    line: {
      type: 'Text',
      props: { value: 'Three invoices are waiting on review.', tone: null },
      children: [],
    },
    hint: {
      type: 'Text',
      props: { value: 'Nothing here is interactive yet.', tone: 'muted' },
      children: [],
    },
  },
};
