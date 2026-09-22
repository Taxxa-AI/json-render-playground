import { z } from 'zod';

/**
 * A catalog entry, described as DATA so a form can edit it.
 *
 * `lib/demo/catalog.ts` writes entries by hand, in TypeScript. That is the
 * real thing and what you ship. But a form cannot edit TypeScript, so the
 * build-catalog lab keeps the same information in this flat shape and
 * projects it three ways:
 *
 *   propsSchema(d)        → a real Zod schema, for a real defineCatalog call
 *   contractSource(d)     → the TypeScript your registry must now satisfy
 *   catalogEntrySource(d) → the entry, as source you can paste back
 *
 * Every projection is derived from the same descriptor, which is the point:
 * one declaration, three consequences.
 */

export type PropKind = 'string' | 'number' | 'boolean' | 'enum' | 'string[]' | 'unknown';

export const PROP_KINDS: PropKind[] = ['string', 'number', 'boolean', 'enum', 'string[]', 'unknown'];

export interface PropDescriptor {
  /** Stable row id — the name is editable, so it cannot be the React key. */
  id: string;
  name: string;
  kind: PropKind;
  /** Comma-separated members, only read when `kind === 'enum'`. */
  values: string;
  nullable: boolean;
}

export interface ComponentDescriptor {
  name: string;
  description: string;
  props: PropDescriptor[];
  /** `slots: ['default', …]` — whether the component accepts `children`. */
  defaultSlot: boolean;
  /** Everything except `default`. These arrive as `slots.<name>`. */
  namedSlots: string[];
  /** The `example` field, as JSON text. Empty means "let the library invent one". */
  exampleText: string;
}

export function enumValues(p: PropDescriptor): string[] {
  return p.values
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** The `slots` array exactly as `defineCatalog` wants it. */
export function slotList(d: ComponentDescriptor): string[] {
  return [...(d.defaultSlot ? ['default'] : []), ...d.namedSlots];
}

/* ------------------------------------------------------------------ zod --- */

function propZod(p: PropDescriptor): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (p.kind) {
    case 'string':
      base = z.string();
      break;
    case 'number':
      base = z.number();
      break;
    case 'boolean':
      base = z.boolean();
      break;
    case 'enum': {
      const vals = enumValues(p);
      // z.enum() refuses an empty member list, and a half-typed enum is the
      // normal state of this editor. Degrade to a plain string instead of
      // throwing the whole catalog away.
      base = vals.length > 0 ? z.enum(vals as [string, ...string[]]) : z.string();
      break;
    }
    case 'string[]':
      base = z.array(z.string());
      break;
    default:
      base = z.unknown();
  }
  return p.nullable ? base.nullable() : base;
}

/** The real Zod object `defineCatalog` will store under `props`. */
export function propsSchema(d: ComponentDescriptor): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of d.props) {
    if (!p.name.trim()) continue;
    shape[p.name.trim()] = propZod(p);
  }
  return z.object(shape);
}

/* -------------------------------------------------------------- example --- */

function exampleFor(p: PropDescriptor): unknown {
  // House convention, and the one the demo catalog follows: a nullable prop
  // appears in the example as an explicit `null`, never omitted. Structured
  // output is happier emitting null than dropping a key.
  if (p.nullable) return null;
  switch (p.kind) {
    case 'string':
      return 'Example';
    case 'number':
      return 42;
    case 'boolean':
      return true;
    case 'enum':
      return enumValues(p)[0] ?? 'value';
    case 'string[]':
      return ['one', 'two'];
    default:
      return null;
  }
}

export function autoExample(d: ComponentDescriptor): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of d.props) {
    if (!p.name.trim()) continue;
    out[p.name.trim()] = exampleFor(p);
  }
  return out;
}

/** Parse the learner's example text, falling back to a generated one. */
export function resolveExample(d: ComponentDescriptor): { value: unknown; error: string | null } {
  const raw = d.exampleText.trim();
  if (!raw) return { value: autoExample(d), error: null };
  try {
    return { value: JSON.parse(raw), error: null };
  } catch (e) {
    return { value: autoExample(d), error: (e as Error).message };
  }
}

/* ----------------------------------------------------------------- text --- */

/** The TypeScript type of one prop, as it appears in the contract. */
export function tsPropType(p: PropDescriptor): string {
  let base: string;
  switch (p.kind) {
    case 'enum': {
      const vals = enumValues(p);
      base = vals.length ? vals.map((v) => `'${v}'`).join(' | ') : 'string';
      break;
    }
    case 'string[]':
      base = 'string[]';
      break;
    default:
      base = p.kind;
  }
  // `unknown | null` collapses to `unknown` in TypeScript, so do not pretend.
  return p.nullable && p.kind !== 'unknown' ? `${base} | null` : base;
}

function zodSource(p: PropDescriptor): string {
  let base: string;
  switch (p.kind) {
    case 'enum': {
      const vals = enumValues(p);
      base = vals.length ? `z.enum([${vals.map((v) => `'${v}'`).join(', ')}])` : 'z.string()';
      break;
    }
    case 'string[]':
      base = 'z.array(z.string())';
      break;
    case 'unknown':
      base = 'z.unknown()';
      break;
    default:
      base = `z.${p.kind}()`;
  }
  return p.nullable ? `${base}.nullable()` : base;
}

const named = (d: ComponentDescriptor) => d.props.filter((p) => p.name.trim());

/**
 * The entry as source, ready to paste into `lib/demo/catalog.ts`.
 * This is the artefact — the lab is a form, but the output is code.
 */
export function catalogEntrySource(d: ComponentDescriptor): string {
  const props = named(d)
    .map((p) => `    ${p.name.trim()}: ${zodSource(p)},`)
    .join('\n');
  const slots = slotList(d)
    .map((s) => `'${s}'`)
    .join(', ');
  const example = JSON.stringify(resolveExample(d).value, null, 2)
    .split('\n')
    .map((l, i) => (i === 0 ? l : `  ${l}`))
    .join('\n');

  return `${d.name}: {
  description:
    ${JSON.stringify(d.description)},
  props: z.object({
${props || '    // no props yet'}
  }),
  slots: [${slots}],
  example: ${example},
},`;
}

/**
 * The compile-time half of the same declaration.
 *
 * `defineRegistry(catalog, { components })` types `components` as
 * `Components<typeof catalog>`, which is a REQUIRED key per catalog entry.
 * So the moment the entry above exists, this function has to exist too or the
 * registry file stops compiling.
 */
export function contractSource(d: ComponentDescriptor): string {
  const propLines = named(d)
    .map((p) => `  ${p.name.trim()}: ${tsPropType(p)};`)
    .join('\n');

  const ctxKeys = ['props'];
  if (d.defaultSlot) ctxKeys.push('children');
  if (d.namedSlots.length) ctxKeys.push('slots');
  ctxKeys.push('emit', 'on', 'bindings', 'loading');

  const slotNotes = [
    d.defaultSlot
      ? `// children      — the 'default' slot, already rendered`
      : `// (no 'default' slot declared — children still arrives at runtime, but\n//  nothing in the prompt invites a model to emit any)`,
    ...d.namedSlots.map((s) => `// slots.${s} — a declared named slot`),
    `// slots.default — undefined; the default slot arrives as children instead`,
  ].join('\n');

  return `// lib/demo/catalog.ts declared it. Now lib/demo/registry.tsx owes an
// implementation — defineRegistry will not compile until this key exists.

import type { BaseComponentProps } from '@json-render/react';
import type { ReactNode } from 'react';

type ${d.name}Props = {
${propLines || '  // no props yet'}
};

// ComponentContext<typeof demoCatalog, '${d.name}'> resolves to exactly this:
${slotNotes}
export const ${d.name} = ({ ${ctxKeys.join(', ')} }: BaseComponentProps<${d.name}Props>): ReactNode => {
  return null; // your React goes here
};

// …and then, in defineRegistry:
//   components: { ...rest, ${d.name} }`;
}

/* ----------------------------------------------------------- validation --- */

/** Reasons this descriptor cannot become a catalog entry yet. */
export function descriptorErrors(d: ComponentDescriptor, taken: string[]): string[] {
  const out: string[] = [];
  const name = d.name.trim();
  if (!name) out.push('Component name is empty.');
  else if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    out.push(`"${name}" is not a PascalCase identifier. The name is the spec's element.type.`);
  else if (taken.includes(name)) out.push(`"${name}" already exists in the catalog.`);

  const seen = new Set<string>();
  for (const p of d.props) {
    const n = p.name.trim();
    if (!n) continue;
    if (seen.has(n)) out.push(`Duplicate prop "${n}".`);
    seen.add(n);
    if (!/^[a-zA-Z_$][\w$]*$/.test(n)) out.push(`"${n}" is not a valid prop name.`);
    if (p.kind === 'enum' && enumValues(p).length === 0)
      out.push(`Enum prop "${n}" has no members — it degrades to z.string().`);
  }

  for (const s of d.namedSlots) {
    if (s === 'default') out.push('Do not list "default" as a named slot — use the children toggle.');
  }
  if (!d.description.trim()) out.push('Description is empty. That string is the only thing the model reads.');
  return out;
}
