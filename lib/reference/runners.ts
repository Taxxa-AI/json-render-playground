import {
  applySpecStreamPatch,
  autoFixSpec,
  buildUserPrompt,
  compileSpecStream,
  createMixedStreamParser,
  createSpecStreamCompiler,
  createStateStore,
  deepMergeSpec,
  diffToPatches,
  evaluateVisibility,
  formatSpecIssues,
  isNonEmptySpec,
  nestedToFlat,
  parseSpecStreamLine,
  resolvePropValue,
  runValidation,
  validateSpec,
  type JsonPatch,
  type PropResolutionContext,
  type Spec,
  type UserPromptOptions,
  type ValidationConfig,
  type VisibilityCondition,
  type VisibilityContext,
} from '@json-render/core';
import { flatToTree } from '@json-render/react';
import { demoCatalog } from '@/lib/demo/catalog';

/**
 * The runner map behind <MiniRun>. Every entry calls the REAL library
 * function in the browser — nothing here is a re-implementation, which is
 * the point: if the library changes, these outputs change with it.
 *
 * A runner takes the raw editor text (one or two panes) and returns text.
 * Parsing lives here so each runner can accept the shape it actually wants:
 * some take JSON, some take JSONL, one takes a bare object of writes.
 */
export interface RunnerResult {
  /** The pretty-printed return value. */
  output: string;
  /** Anything the call printed or implied, shown under the output. */
  notes?: string[];
  /** Set when the input could not be parsed, or the call threw. */
  error?: string;
}

export interface Runner {
  /** Label for the output pane. */
  outputLabel: string;
  run: (a: string, b?: string) => RunnerResult;
}

const show = (value: unknown) => {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

function parse<T>(text: string, what: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`${what} is not valid JSON — ${(e as Error).message}`);
  }
}

function guard(fn: () => RunnerResult): RunnerResult {
  try {
    return fn();
  } catch (e) {
    return { output: '', error: (e as Error).message };
  }
}

export const RUNNERS: Record<string, Runner> = {
  validateSpec: {
    outputLabel: 'SpecValidationIssues',
    run: (a) =>
      guard(() => {
        const spec = parse<Spec>(a, 'spec');
        const result = validateSpec(spec, { checkOrphans: true });
        return {
          output: show(result),
          notes: [
            `valid: ${result.valid} · ${result.issues.filter((i) => i.severity === 'error').length} error(s), ${result.issues.filter((i) => i.severity === 'warning').length} warning(s)`,
            'checkOrphans is on here, so orphaned_element warnings appear. It is off by default.',
          ],
        };
      }),
  },

  autoFixSpec: {
    outputLabel: 'fixed spec + fixDetails',
    run: (a, b) =>
      guard(() => {
        const spec = parse<Spec>(a, 'spec');
        const lossy = (b ?? 'true').trim() !== 'false';
        const result = autoFixSpec(spec, { lossy });
        return {
          output: show({ spec: result.spec, fixDetails: result.fixDetails }),
          notes: [
            `lossy: ${lossy} — ${result.fixDetails.filter((f) => f.lossy).length} lossy fix(es), ${result.fixDetails.filter((f) => !f.lossy).length} lossless.`,
            'Lossless fixes relocate misplaced fields. Lossy fixes prune dangling references, which removes UI.',
          ],
        };
      }),
  },

  formatSpecIssues: {
    outputLabel: 'repair prompt text',
    run: (a) =>
      guard(() => {
        const spec = parse<Spec>(a, 'spec');
        const { issues } = validateSpec(spec, { checkOrphans: true });
        const text = formatSpecIssues(issues);
        return {
          output: text === '' ? '(empty string — no errors, only warnings or nothing at all)' : text,
          notes: ['Warnings are filtered out. No errors means the empty string, so test for it before re-prompting.'],
        };
      }),
  },

  isNonEmptySpec: {
    outputLabel: 'boolean',
    run: (a) =>
      guard(() => {
        const value = parse<unknown>(a, 'value');
        const result = isNonEmptySpec(value);
        return {
          output: String(result),
          notes: ['True needs: root is a string, elements is a non-null object, and it has at least one key.'],
        };
      }),
  },

  deepMergeSpec: {
    outputLabel: 'merged object',
    run: (a, b) =>
      guard(() => {
        const base = parse<Record<string, unknown>>(a, 'base');
        const patch = parse<Record<string, unknown>>(b ?? '{}', 'patch');
        return {
          output: show(deepMergeSpec(base, patch)),
          notes: ['RFC 7396: null deletes the key, arrays replace wholesale, plain objects recurse.'],
        };
      }),
  },

  diffToPatches: {
    outputLabel: 'JsonPatch[]',
    run: (a, b) =>
      guard(() => {
        const from = parse<Record<string, unknown>>(a, 'from');
        const to = parse<Record<string, unknown>>(b ?? '{}', 'to');
        const patches = diffToPatches(from, to);
        return {
          output: show(patches),
          notes: [`${patches.length} operation(s). Arrays are compared shallowly and replaced atomically.`],
        };
      }),
  },

  nestedToFlat: {
    outputLabel: 'Spec',
    run: (a) =>
      guard(() => {
        const nested = parse<Record<string, unknown>>(a, 'nested tree');
        return {
          output: show(nestedToFlat(nested)),
          notes: ['Keys are generated in walk order: el-0, el-1, … The root node\'s `state` is hoisted to spec.state.'],
        };
      }),
  },

  flatToTree: {
    outputLabel: 'Spec',
    run: (a) =>
      guard(() => {
        const rows = parse<Parameters<typeof flatToTree>[0]>(a, 'FlatElement[]');
        return {
          output: show(flatToTree(rows)),
          notes: ['Exported by @json-render/react. The row with parentKey null becomes the root.'],
        };
      }),
  },

  compileSpecStream: {
    outputLabel: 'compiled object',
    run: (a) =>
      guard(() => {
        const lines = a.split('\n');
        const skipped = lines.filter((l) => l.trim() !== '' && parseSpecStreamLine(l) === null).length;
        return {
          output: show(compileSpecStream(a)),
          notes: [`${lines.length} line(s) in, ${skipped} skipped as non-patch.`],
        };
      }),
  },

  createSpecStreamCompiler: {
    outputLabel: 'push() result',
    run: (a) =>
      guard(() => {
        const compiler = createSpecStreamCompiler<Record<string, unknown>>({ root: 'seed' });
        const before = compiler.getResult();
        const pushed = compiler.push(a);
        return {
          output: show({ beforePush: before, newPatches: pushed.newPatches, result: pushed.result }),
          notes: [
            'The compiler was seeded with { root: "seed" } — initial state survives until a patch overwrites it.',
            'A trailing partial line stays in the buffer and is not in newPatches. Push the rest and it lands.',
          ],
        };
      }),
  },

  parseSpecStreamLine: {
    outputLabel: 'one result per line',
    run: (a) =>
      guard(() => {
        const rows = a.split('\n').map((line) => ({ line, parsed: parseSpecStreamLine(line) }));
        return {
          output: rows.map((r) => `${r.parsed ? 'patch ' : 'null  '} ${JSON.stringify(r.line)}`).join('\n'),
          notes: ['A line must trim to something starting with `{`, parse as JSON, and carry a truthy `op` plus a defined `path`.'],
        };
      }),
  },

  applySpecStreamPatch: {
    outputLabel: 'object after every patch',
    run: (a, b) =>
      guard(() => {
        const obj = parse<Record<string, unknown>>(a, 'target object');
        const patches = (b ?? '')
          .split('\n')
          .map((l) => parseSpecStreamLine(l))
          .filter((p): p is JsonPatch => p !== null);
        const notes: string[] = [];
        for (const patch of patches) {
          try {
            applySpecStreamPatch(obj, patch);
            notes.push(`${patch.op} ${patch.path} → ok`);
          } catch (e) {
            notes.push(`${patch.op} ${patch.path} → THREW: ${(e as Error).message}`);
          }
        }
        notes.push('The object is MUTATED in place. All six RFC 6902 ops are supported; only `test` throws.');
        return { output: show(obj), notes };
      }),
  },

  evaluateVisibility: {
    outputLabel: 'boolean',
    run: (a, b) =>
      guard(() => {
        const condition = parse<VisibilityCondition>(a, 'condition');
        const ctx = parse<VisibilityContext>(b ?? '{"stateModel":{}}', 'context');
        return {
          output: String(evaluateVisibility(condition, ctx)),
          notes: ['undefined → true. A null or string condition throws, because the code reaches `"$index" in cond`.'],
        };
      }),
  },

  resolvePropValue: {
    outputLabel: 'resolved value',
    run: (a, b) =>
      guard(() => {
        const expr = parse<unknown>(a, 'expression');
        const ctx = parse<PropResolutionContext>(b ?? '{"stateModel":{}}', 'context');
        const result = resolvePropValue(expr, ctx);
        return {
          output: show(result),
          notes: [`typeof result: ${typeof result}`, 'A miss is undefined, an empty string, or a passthrough — never a throw.'],
        };
      }),
  },

  runValidation: {
    outputLabel: 'ValidationResult',
    run: (a, b) =>
      guard(() => {
        const config = parse<ValidationConfig>(a, 'ValidationConfig');
        const ctx = parse<{ value: unknown; stateModel: Record<string, unknown> }>(b ?? '{"value":"","stateModel":{}}', 'context');
        const result = runValidation(config, { value: ctx.value, stateModel: ctx.stateModel ?? {} });
        return {
          output: show(result),
          notes: [
            '`checks` lists passing checks too. An unknown check type is reported valid, with a console warning.',
            '`validateOn` is carried but never read by the library — your component owns the timing.',
          ],
        };
      }),
  },

  buildUserPrompt: {
    outputLabel: 'user prompt',
    run: (a) =>
      guard(() => {
        const options = parse<UserPromptOptions>(a, 'UserPromptOptions');
        const text = buildUserPrompt(options);
        return {
          output: text,
          notes: [
            `${text.length} characters.`,
            isNonEmptySpec(options.currentSpec)
              ? 'currentSpec is non-empty, so this is the REFINEMENT form: patch-only instructions.'
              : 'No usable currentSpec, so this is the FRESH form: the streaming-order reminder.',
          ],
        };
      }),
  },

  createStateStore: {
    outputLabel: 'snapshot after the writes',
    run: (a, b) =>
      guard(() => {
        const initial = parse<Record<string, unknown>>(a, 'initial state');
        const writes = parse<Record<string, unknown>>(b ?? '{}', 'writes');
        const store = createStateStore(initial);
        let notifications = 0;
        store.subscribe(() => {
          notifications += 1;
        });
        const notes: string[] = [];
        for (const [path, value] of Object.entries(writes)) {
          const before = notifications;
          store.set(path, value);
          notes.push(`set ${path} → ${notifications > before ? 'notified' : 'NO-OP (=== previous value)'}`);
        }
        notes.push(`${notifications} notification(s) in total. Equality is by reference.`);
        return { output: show(store.getSnapshot()), notes };
      }),
  },

  createMixedStreamParser: {
    outputLabel: 'classification',
    run: (a) =>
      guard(() => {
        const text: string[] = [];
        const patches: JsonPatch[] = [];
        const parser = createMixedStreamParser({
          onText: (t) => text.push(t),
          onPatch: (p) => patches.push(p),
        });
        parser.push(a);
        parser.flush();
        return {
          output: show({ text, patches }),
          notes: [`${text.length} text line(s), ${patches.length} patch(es).`, 'flush() was called — without it the last unterminated line is lost.'],
        };
      }),
  },

  catalogPrompt: {
    outputLabel: 'catalog.prompt() — first 60 lines',
    run: (a) =>
      guard(() => {
        const options = parse<Parameters<typeof demoCatalog.prompt>[0]>(a || '{}', 'PromptOptions');
        const prompt = demoCatalog.prompt(options);
        const lines = prompt.split('\n');
        return {
          output: lines.slice(0, 60).join('\n') + (lines.length > 60 ? `\n\n… ${lines.length - 60} more lines` : ''),
          notes: [
            `${prompt.length} characters, ${lines.length} lines, for ${demoCatalog.componentNames.length} components and ${demoCatalog.actionNames.length} actions.`,
            'Roughly one quarter of that is the twelve default rules baked into the React schema.',
          ],
        };
      }),
  },

  catalogValidate: {
    outputLabel: 'SpecValidationResult',
    run: (a) =>
      guard(() => {
        const spec = parse<unknown>(a, 'spec');
        const result = demoCatalog.validate(spec);
        if (result.success) {
          return { output: show({ success: true, data: result.data }), notes: ['On success the `error` key is absent, not undefined.'] };
        }
        return {
          output: show({ success: false, issues: result.error?.issues }),
          notes: [`${result.error?.issues.length ?? 0} Zod issue(s). This checks component names and prop types — validateSpec checks structure.`],
        };
      }),
  },

  catalogJsonSchema: {
    outputLabel: 'JSON Schema',
    run: (a) =>
      guard(() => {
        const options = parse<Parameters<typeof demoCatalog.jsonSchema>[0]>(a || '{}', 'JsonSchemaOptions');
        const schema = demoCatalog.jsonSchema(options);
        return {
          output: show(schema),
          notes: [
            'catalog.jsonSchema() exists in 0.20.0 and returns a plain object.',
            'In strict mode `elements` is a record, which cannot be represented — it comes out as an opaque empty object.',
          ],
        };
      }),
  },
};
