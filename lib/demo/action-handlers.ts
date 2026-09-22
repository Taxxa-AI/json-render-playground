/**
 * The handlers behind the custom actions in the actions & watchers lab.
 *
 * They live in a real file, not inline in the lab, for one reason: the lab
 * SHOWS them. `scripts/gen-source.ts` slices each entry out of this source and
 * emits it into `lib/demo/source.generated.ts`, so what you read under the
 * playground is the function that just ran.
 *
 * Note the signature. A handler is `(params) => Promise<unknown>` and nothing
 * more — no setState, no store, no access to the renderer. Whatever it
 * "loads" has to come back through `onSuccess`, or through a store your own
 * code closes over. That constraint is the whole reason `onSuccess` exists.
 */

/**
 * The two switches above the lab. Real handlers would read a network; these
 * read a mutable module object so you can make them slow or make them throw
 * without touching the spec.
 */
export const handlerEnv = { failing: false, slow: true };

export const demoHandlers = {
  /** Throws on demand, so onError has something to catch. */
  deleteAll: async () => {
    if (handlerEnv.slow) await new Promise((r) => setTimeout(r, 450));
    if (handlerEnv.failing) throw new Error('backend refused');
  },

  /** Returns a value. Nothing in the spec can read it — only your own code can. */
  save: async (params: Record<string, unknown>) => {
    if (handlerEnv.slow) await new Promise((r) => setTimeout(r, 250));
    if (handlerEnv.failing) throw new Error('validation rejected the draft');
    return { savedAt: Date.now(), draft: params.draft };
  },

  /**
   * The one a watcher calls. It cannot write /cities itself — that is why the
   * watch binding pairs it with a setState, and why its onSuccess exists.
   */
  loadCities: async () => {
    if (handlerEnv.slow) await new Promise((r) => setTimeout(r, 300));
    if (handlerEnv.failing) throw new Error('city service unavailable');
  },

  /** A handler is allowed to do nothing at all. The dispatch still settles. */
  notify: async () => {},
};

export type DemoHandlerName = keyof typeof demoHandlers;
