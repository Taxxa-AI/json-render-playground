import type { Spec } from '@json-render/core';

/**
 * THE SPEC. A flat map of keyed elements, not a nested tree.
 *
 * Two expressions do the work here. `$state` READS a path. `$bindState`
 * reads the same path AND hands the component a write-back path, which is
 * the only way a control can put a value back into the model.
 */
export const spec: Spec = {
  root: 'page',
  elements: {
    page: {
      type: 'Page',
      props: { title: 'Invoice review', subtitle: { $state: '/company' } },
      children: ['heading', 'filter', 'note', 'echo'],
    },
    heading: {
      type: 'Heading',
      props: { text: 'Outstanding', level: '2' },
      children: [],
    },
    filter: {
      type: 'Toggle',
      props: { label: 'Unpaid only', checked: { $bindState: '/unpaidOnly' } },
      children: [],
    },
    note: {
      type: 'TextField',
      props: {
        label: 'Draft note',
        value: { $bindState: '/draft/note' },
        placeholder: 'Type here — the echo below is reading the same path',
      },
      children: [],
    },
    echo: {
      type: 'Text',
      props: { value: { $state: '/draft/note' }, tone: 'muted' },
      children: [],
    },
  },
};
