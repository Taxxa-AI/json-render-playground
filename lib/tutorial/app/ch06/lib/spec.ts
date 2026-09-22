import type { Spec } from '@json-render/core';

/**
 * THE SPEC, now with a list.
 *
 * `repeat` belongs to the element that OWNS the list, and it repeats that
 * element's CHILDREN — the owner itself still renders once. Inside that
 * scope `$item`, `$index` and `$bindItem` resolve against the current row.
 */
export const spec: Spec = {
  root: 'page',
  elements: {
    page: {
      type: 'Page',
      props: { title: 'Invoice review', subtitle: { $state: '/company' } },
      children: ['heading', 'filter', 'list'],
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

    // One Stack, rendered once. Its child `row` is rendered once per invoice.
    list: {
      type: 'Stack',
      props: { direction: 'column', gap: 'md' },
      repeat: { statePath: '/invoices', key: 'id' },
      children: ['row'],
    },

    row: {
      type: 'Stack',
      props: { direction: 'column', gap: 'sm' },
      // Show the row when the filter is off OR when this invoice is not paid.
      visible: {
        $or: [
          { $state: '/unpaidOnly', eq: false },
          { $item: 'status', neq: 'paid' },
        ],
      },
      children: ['rowTop', 'rowNote'],
    },
    rowTop: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm' },
      children: ['rowRef', 'rowStatus'],
    },
    rowRef: {
      type: 'Text',
      props: { value: { $template: '${ref} · ${client}' }, tone: null },
      children: [],
    },
    rowStatus: {
      type: 'Badge',
      props: {
        label: { $item: 'status' },
        tone: { $cond: { $item: 'status', eq: 'paid' }, $then: 'success', $else: 'warning' },
      },
      children: [],
    },
    rowNote: {
      type: 'TextField',
      props: {
        label: { $template: 'Note on ${ref}' },
        value: { $bindItem: 'note' },
        placeholder: 'Add a note',
      },
      children: [],
    },
  },
};
