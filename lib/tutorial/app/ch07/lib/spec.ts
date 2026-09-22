import type { Spec } from '@json-render/core';

/**
 * THE SPEC, now with behaviour.
 *
 * A spec cannot hold code, so behaviour works by naming. The component emits
 * an event, the element's `on` map turns that name into an action binding,
 * and the runtime dispatches it — to a built-in or to your handler.
 */
export const spec: Spec = {
  root: 'page',
  elements: {
    page: {
      type: 'Page',
      props: { title: 'Invoice review', subtitle: { $state: '/company' } },
      children: ['flash', 'filter', 'list', 'addBox'],
    },

    // `visible` with no operator is a truthiness check, so an empty flash hides.
    flash: {
      type: 'Text',
      props: { value: { $state: '/flash' }, tone: 'muted' },
      visible: { $state: '/flash' },
      children: [],
    },

    filter: {
      type: 'Toggle',
      props: { label: 'Unpaid only', checked: { $bindState: '/unpaidOnly' } },
      children: [],
    },

    list: {
      type: 'Stack',
      props: { direction: 'column', gap: 'md' },
      repeat: { statePath: '/invoices', key: 'id' },
      children: ['row'],
    },
    row: {
      type: 'Stack',
      props: { direction: 'column', gap: 'sm' },
      visible: {
        $or: [
          { $state: '/unpaidOnly', eq: false },
          { $item: 'status', neq: 'paid' },
        ],
      },
      children: ['rowTop', 'rowNote', 'rowActions'],
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

    rowActions: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm' },
      children: ['markButton', 'removeButton'],
    },

    // A CUSTOM action. It reaches your handler, so confirm / onSuccess /
    // onError all apply. Params are resolved in the row's scope first.
    markButton: {
      type: 'Button',
      props: { label: 'Mark paid', variant: 'primary' },
      visible: { $item: 'status', neq: 'paid' },
      on: {
        press: {
          action: 'markPaid',
          params: { id: { $item: 'id' }, note: { $item: 'note' } },
          confirm: {
            title: 'Mark paid?',
            message: 'This writes the status and the note together.',
            variant: 'danger',
          },
          onSuccess: { set: { '/flash': 'Invoice marked paid.' } },
          onError: { set: { '/flash': 'That invoice could not be updated.' } },
        },
      },
      children: [],
    },

    // A BUILT-IN. No catalog entry, no handler — and the `confirm` below is
    // silently ignored, because built-ins return before the dialog is reached.
    removeButton: {
      type: 'Button',
      props: { label: 'Remove', variant: 'ghost' },
      on: {
        press: {
          action: 'removeState',
          params: { statePath: '/invoices', index: { $index: true } },
          confirm: { title: 'Remove?', message: 'You will not see this dialog.' },
        },
      },
      children: [],
    },

    addBox: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm' },
      children: ['addField', 'addButton'],
    },
    addField: {
      type: 'TextField',
      props: { label: 'New reference', value: { $bindState: '/draft/ref' }, placeholder: 'INV-1044' },
      children: [],
    },
    addButton: {
      type: 'Button',
      props: { label: 'Add draft', variant: 'ghost' },
      on: {
        press: {
          action: 'pushState',
          params: {
            statePath: '/invoices',
            value: {
              id: '$id',
              ref: { $state: '/draft/ref' },
              client: 'New client',
              amountCents: 0,
              status: 'unpaid',
              note: '',
            },
            clearStatePath: '/draft/ref',
          },
        },
      },
      children: [],
    },
  },
};
