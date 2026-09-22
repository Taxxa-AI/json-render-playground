import type { Spec } from '@json-render/core';

/**
 * THE SPEC, now with behaviour.
 *
 * A spec cannot hold code, so behaviour works by naming. Events name actions;
 * checks name validation functions. Neither one carries a function — the
 * registry and the provider supply those.
 */
export const spec: Spec = {
  root: 'page',
  elements: {
    page: {
      type: 'Page',
      props: { title: 'Invoice review', subtitle: { $state: '/company' } },
      children: ['flash', 'filter', 'list', 'addBox', 'saveRow', 'invalidHint'],
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
        // `minLength` is built in. `notPlaceholder` is ours, registered on the
        // provider as `validationFunctions`. A `type` that matches neither is
        // logged once and counted as PASSING — a typo here validates nothing.
        checks: [
          { type: 'minLength', args: { min: 4 }, message: 'Write at least four characters.' },
          { type: 'notPlaceholder', args: null, message: 'Replace TODO with a real note.' },
        ],
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

    saveRow: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm' },
      children: ['saveButton'],
    },

    // An ARRAY of bindings runs in order, each awaited before the next. The
    // built-in `validateForm` runs every registered field, then writes
    // `{ valid, errors }` to `statePath`. It does NOT stop the next binding.
    saveButton: {
      type: 'Button',
      props: { label: 'Save all notes', variant: 'primary' },
      on: {
        press: [
          { action: 'validateForm', params: { statePath: '/formValidation' } },
          { action: 'setState', params: { statePath: '/flash', value: 'Saved (valid or not).' } },
        ],
      },
      children: [],
    },

    invalidHint: {
      type: 'Text',
      props: { value: 'Some notes are still invalid — and they were saved anyway.', tone: 'danger' },
      visible: { $state: '/formValidation/valid', eq: false },
      children: [],
    },
  },
};
