import { transform } from 'sucrase';
import type { BaseComponentProps } from '@json-render/react';
import type { ReactNode } from 'react';

/**
 * Compile a registry component the learner typed, in the browser.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * YES, THIS EVALUATES USER CODE. That is fine HERE and nowhere else.
 *
 * This is a local, single-user learning playground: the only person who can
 * put code in the editor is the person already running the page, who could
 * open devtools and do the same thing. There is no server, no other tenant and
 * no stored program. Never ship this shape in a product — `new Function` over
 * text you did not write is arbitrary code execution with your user's session.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Two steps, both real:
 *
 *  1. sucrase strips the TypeScript and rewrites JSX. `jsxRuntime: 'classic'`
 *     with `jsxPragma: 'h'` means the output calls a bare `h(...)`, which we
 *     then supply as `React.createElement`. The automatic runtime would emit
 *     an `import` instead, and `new Function` bodies cannot import.
 *  2. `new Function` with one parameter per name we want in scope.
 *
 * The learner's text is an EXPRESSION (an arrow function or a named function
 * expression), so it is wrapped in `const __Component = ( … );` before the
 * transform. That matters: sucrase hoists its helpers (`_optionalChain`, used
 * by `?.`) to the very top of the output, so a bare `return <expr>` would end
 * up with the helper in front of the `return` and fail to parse.
 */

export type LearnerComponent = (ctx: BaseComponentProps<Record<string, unknown>>) => ReactNode;

export interface CompileResult {
  ok: boolean;
  component: LearnerComponent | null;
  /** Compile-time (syntax/type-strip) or evaluation-time failure. */
  error: string | null;
  /** Where the failure happened, for the label under the editor. */
  phase: 'transform' | 'evaluate' | null;
}

export function compileComponent(code: string, scope: Record<string, unknown>): CompileResult {
  let js: string;
  try {
    js = transform(`const __Component = (\n${code}\n);`, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'classic',
      jsxPragma: 'h',
      jsxFragmentPragma: 'Fragment',
      // Drops the __self/__source debug props React dev builds would add.
      production: true,
    }).code;
  } catch (e) {
    return { ok: false, component: null, error: (e as Error).message, phase: 'transform' };
  }

  const names = Object.keys(scope);
  try {
    const factory = new Function(...names, `${js}\nreturn __Component;`) as (
      ...args: unknown[]
    ) => unknown;
    const value = factory(...names.map((n) => scope[n]));
    if (typeof value !== 'function') {
      return {
        ok: false,
        component: null,
        error: `Expected a function, got ${value === null ? 'null' : typeof value}. The editor holds one expression — an arrow function or a named function expression.`,
        phase: 'evaluate',
      };
    }
    return { ok: true, component: value as LearnerComponent, error: null, phase: null };
  } catch (e) {
    return { ok: false, component: null, error: (e as Error).message, phase: 'evaluate' };
  }
}
