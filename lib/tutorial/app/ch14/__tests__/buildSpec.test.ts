import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSpec } from '../lib/build-spec';
import type { Invoice } from '../lib/invoices';

/**
 * Run with `node --test` or `bun test`.
 *
 * The value of compiling the spec is that this file is possible at all: the
 * whole UI is now a pure function, so it can be asserted without a browser,
 * a renderer, or a React tree.
 */
const FIXTURE: Invoice[] = [
  { id: 'a', ref: 'INV-1', client: 'One', amountCents: 1000, status: 'unpaid', note: '' },
  { id: 'b', ref: 'INV-2', client: 'Two', amountCents: 2000, status: 'paid', note: 'done' },
  { id: 'c', ref: 'INV-3', client: 'Three', amountCents: 3000, status: 'overdue', note: '' },
];

test('hides paid invoices but keeps their state index', () => {
  const spec = buildSpec(FIXTURE, { title: 'Review', currency: 'EUR', showPaid: false });

  assert.deepEqual(spec.elements.page.children, ['flash', 'filter', 'row-a', 'row-c']);

  // The row AFTER the hidden one must still bind to index 2, not index 1.
  assert.deepEqual(spec.elements['row-c-note'].props.value, { $bindState: '/invoices/2/note' });
});

test('every child reference resolves', () => {
  const spec = buildSpec(FIXTURE, { title: 'Review', currency: 'EUR', showPaid: true });

  for (const [key, element] of Object.entries(spec.elements)) {
    for (const child of element.children ?? []) {
      assert.ok(spec.elements[child], `${key} points at missing child ${child}`);
    }
  }
  assert.ok(spec.elements[spec.root], 'root must exist');
});

test('is deterministic', () => {
  const settings = { title: 'Review', currency: 'EUR', showPaid: true };
  assert.equal(JSON.stringify(buildSpec(FIXTURE, settings)), JSON.stringify(buildSpec(FIXTURE, settings)));
});
