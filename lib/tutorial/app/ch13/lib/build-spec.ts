import type { Spec, UIElement } from '@json-render/core';
import type { Invoice } from './invoices';

export interface ReviewSettings {
  title: string;
  currency: string;
  showPaid: boolean;
}

/**
 * COMPILE the spec from the domain model.
 *
 * Chapter six used `repeat`, which keeps one row template and lets the
 * runtime iterate. This does the opposite: it unrolls the list at build
 * time. You give up live array growth and you gain a spec that is a pure
 * function of your data — diffable, snapshot-testable, cacheable.
 */
export function buildSpec(invoices: Invoice[], settings: ReviewSettings): Spec {
  const elements: Record<string, UIElement> = {};
  const rows: string[] = [];

  // `entries()` so `index` stays the position in the STATE array. Filtering
  // with a counter instead would bind row three to invoice four — the exact
  // bug a compiler exists to make impossible.
  for (const [index, invoice] of invoices.entries()) {
    if (!settings.showPaid && invoice.status === 'paid') continue;

    // Keys derive from the invoice id, never from the loop counter, so two
    // builds of the same data produce byte-identical specs.
    const key = `row-${invoice.id}`;
    rows.push(key);

    elements[key] = {
      type: 'Stack',
      props: { direction: 'column', gap: 'sm' },
      // The button only exists when it can do something. A compiler can
      // delete an element; a `visible` condition can only hide one.
      children:
        invoice.status === 'paid'
          ? [`${key}-top`, `${key}-note`]
          : [`${key}-top`, `${key}-note`, `${key}-action`],
    };
    elements[`${key}-top`] = {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm' },
      children: [`${key}-ref`, `${key}-amount`, `${key}-status`],
    };
    elements[`${key}-ref`] = {
      type: 'Text',
      // A literal, because the value is known now and will not change.
      props: { value: `${invoice.ref} · ${invoice.client}`, tone: null },
      children: [],
    };
    elements[`${key}-amount`] = {
      type: 'Text',
      props: { value: { $money: invoice.amountCents, currency: settings.currency }, tone: null },
      children: [],
    };
    elements[`${key}-status`] = {
      type: 'Badge',
      props: {
        label: invoice.status,
        tone: invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'danger' : 'warning',
      },
      children: [],
    };
    elements[`${key}-note`] = {
      type: 'TextField',
      props: {
        label: `Note on ${invoice.ref}`,
        // An EXPRESSION, because this one is written back to. The index is
        // baked in here, which is why it had to be the state index.
        value: { $bindState: `/invoices/${index}/note` },
        placeholder: 'Add a note',
        checks: [{ type: 'minLength', args: { min: 4 }, message: 'Write at least four characters.' }],
      },
      children: [],
    };

    if (invoice.status !== 'paid') {
      elements[`${key}-action`] = {
        type: 'Button',
        props: { label: 'Mark paid', variant: 'primary' },
        on: {
          press: {
            action: 'markPaid',
            // Params are baked in too — no `$item`, because there is no
            // repeat scope any more. Each button carries its own invoice.
            params: { id: invoice.id, note: { $state: `/invoices/${index}/note` } },
            confirm: { title: 'Mark paid?', message: `${invoice.ref} will be marked paid.`, variant: 'danger' },
            onSuccess: { set: { '/flash': 'Invoice marked paid.' } },
            onError: { set: { '/flash': 'That invoice could not be updated.' } },
          },
        },
        children: [],
      };
    }
  }

  // Two elements that stay data-driven: the filter writes to state, and the
  // flash reads it. Compiling does not mean removing every expression.
  elements.flash = {
    type: 'Text',
    props: { value: { $state: '/flash' }, tone: 'muted' },
    visible: { $state: '/flash' },
    children: [],
  };
  elements.filter = {
    type: 'Toggle',
    props: { label: 'Unpaid only', checked: { $bindState: '/unpaidOnly' } },
    children: [],
  };

  elements.page = {
    type: 'Page',
    props: { title: settings.title, subtitle: `${rows.length} of ${invoices.length} shown` },
    children: ['flash', 'filter', ...rows],
  };

  return { root: 'page', elements };
}
