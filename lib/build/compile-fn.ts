/**
 * `new Function` over a learner-typed function BODY.
 *
 * Same caveat as `compile-component.ts`: evaluating text as code is acceptable
 * in a local single-user playground and nowhere else.
 *
 * Bodies rather than whole functions, because the thing being taught is the
 * signature. A directive resolver is handed `(value, ctx)` and nothing else; a
 * validation function is handed `(value, args)` and must return a boolean. By
 * fixing the parameter list and letting the learner own only the body, the
 * editor cannot drift away from the real contract.
 */

export interface CompiledFn<F> {
  ok: boolean;
  fn: F | null;
  error: string | null;
}

export function compileBody<F>(params: string[], body: string): CompiledFn<F> {
  try {
    const fn = new Function(...params, body) as F;
    return { ok: true, fn, error: null };
  } catch (e) {
    return { ok: false, fn: null, error: (e as Error).message };
  }
}

/**
 * The async variant. `new Function` produces a plain function, so `await`
 * inside the body is a syntax error — you need the AsyncFunction constructor,
 * which has no global binding and is reached through a literal async function's
 * prototype. Action handlers are awaited by the dispatcher before it picks
 * `onSuccess` or `onError`, so they are exactly the case that needs this.
 */
const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export function compileAsyncBody<F>(params: string[], body: string): CompiledFn<F> {
  try {
    const fn = new AsyncFunction(...params, body) as unknown as F;
    return { ok: true, fn, error: null };
  } catch (e) {
    return { ok: false, fn: null, error: (e as Error).message };
  }
}

/** Trim a thrown value down to one line for a log row. */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
