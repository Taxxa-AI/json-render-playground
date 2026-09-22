import { type ComputedFunction, defineDirective, resolvePropValue } from '@json-render/core';
import { z } from 'zod';

/**
 * A DIRECTIVE is a new `$`-prefixed expression. The library ships $state,
 * $item, $cond, $template and $computed; this adds $money.
 *
 * Use one when the transform is presentational and belongs in the spec.
 * Use a $computed function when the transform is business logic.
 */
export const moneyDirective = defineDirective({
  name: '$money',
  // This sentence is not decoration: `catalog.prompt({ directives })` puts it
  // in the system prompt, so it is how a model learns the directive exists.
  description: 'Format an integer number of cents as currency. `currency` is an ISO code and defaults to EUR.',
  schema: z.object({
    // `unknown`, not `number`, so the amount can itself be an expression.
    $money: z.unknown(),
    currency: z.string().nullable().optional(),
  }),
  resolve(value, ctx) {
    // Resolve the inner value first. This is what makes directives compose
    // with $state, $item and $computed instead of only accepting literals.
    const cents = resolvePropValue(value.$money, ctx);
    const amount = typeof cents === 'number' ? cents : Number(cents ?? Number.NaN);
    if (!Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: value.currency ?? 'EUR',
    }).format(amount / 100);
  },
});

/** Pass this same array to the provider AND to `catalog.prompt()`. */
export const directives = [moneyDirective];

/**
 * `$computed` functions. Args are resolved before the call, so a function
 * only ever sees plain values and never an expression.
 */
export const functions: Record<string, ComputedFunction> = {
  unpaidTotal: (args) => {
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    return invoices
      .filter((i) => (i as { status?: string }).status !== 'paid')
      .reduce((sum, i) => sum + Number((i as { amountCents?: number }).amountCents ?? 0), 0);
  },

  unpaidCount: (args) => {
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    return invoices.filter((i) => (i as { status?: string }).status !== 'paid').length;
  },
};
