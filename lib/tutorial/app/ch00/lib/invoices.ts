/**
 * The domain model. json-render never reads this file.
 *
 * It reads the STATE you seed from it, and the CATALOG you write next door.
 * Keeping the domain in plain TypeScript is the whole point: the spec layer
 * stays a view, and this stays the thing your tests and your database agree on.
 */
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';

export interface Invoice {
  /** Stable identity. The repeat `key` and every action param use this. */
  id: string;
  ref: string;
  client: string;
  /** Integer cents. Never floats for money, and never a pre-formatted string. */
  amountCents: number;
  status: InvoiceStatus;
  note: string;
}

export const INVOICES: Invoice[] = [
  { id: 'i1', ref: 'INV-1041', client: 'Mellon Bakery', amountCents: 48250, status: 'unpaid', note: '' },
  { id: 'i2', ref: 'INV-1042', client: 'Kestrel Design', amountCents: 120000, status: 'paid', note: 'Paid by transfer.' },
  { id: 'i3', ref: 'INV-1043', client: 'Ardmore Ltd', amountCents: 9900, status: 'overdue', note: 'Chase on Friday.' },
];
