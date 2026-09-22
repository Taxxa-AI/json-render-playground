'use client';

import { defineRegistry } from '@json-render/react';
import { altComponentImpls } from './alt-components';
import { demoCatalog } from './catalog';
import { guardAll } from './guard';

/**
 * The same catalog, a different registry.
 *
 * Note the first argument is `demoCatalog` — identical to the one in
 * registry.tsx. TypeScript checks BOTH implementations against the same Zod
 * props, so neither can drift from the contract.
 */
export const { registry: altRegistry } = defineRegistry(demoCatalog, {
  components: guardAll(altComponentImpls),
  actions: { submit: async () => {}, notify: async () => {}, reset: async () => {} },
});
