'use client';

import { Component, type ComponentType, type ReactNode } from 'react';

/**
 * The `lib/demo/guard.tsx` pattern, with the caught message handed back out.
 *
 * Same two rules as the original, and both are easy to get wrong:
 *
 *  1. A boundary catches errors thrown by its CHILDREN during render, never by
 *     its own render. So the guard must render `<Impl {...props} />` as an
 *     element. Calling `Impl(props)` inline puts the throw inside the
 *     boundary's own render and it escapes to the page.
 *  2. Boundaries do not catch during server rendering at all. Everything here
 *     is client-only for that reason.
 *
 * The extra bit: `onError` lets the lab tick a checklist item when the guard
 * does its job, and `resetKey` clears the caught state on recompile — without
 * it a boundary that has tripped stays tripped forever and the next edit looks
 * broken too.
 */

interface Props {
  name: string;
  /** Change this to re-mount and clear a previous catch (e.g. compile nonce). */
  resetKey: unknown;
  onError?: (message: string) => void;
  children: ReactNode;
}

export class ComponentGuard extends Component<Props, { message: string | null; key: unknown }> {
  state = { message: null as string | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  static getDerivedStateFromProps(props: Props, state: { message: string | null; key: unknown }) {
    if (props.resetKey !== state.key) return { message: null, key: props.resetKey };
    return null;
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error instanceof Error ? error.message : String(error));
  }

  render() {
    if (this.state.message !== null) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 font-mono text-[12px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {this.props.name} threw: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}

/** Wrap one implementation so a throw shows a red box instead of a blank page. */
export function guardOne<P extends Record<string, unknown>>(
  name: string,
  Impl: ComponentType<P>,
  resetKey: unknown,
  onError?: (message: string) => void,
): ComponentType<P> {
  const Guarded = (props: P) => (
    <ComponentGuard name={name} resetKey={resetKey} onError={onError}>
      <Impl {...props} />
    </ComponentGuard>
  );
  Guarded.displayName = `Guarded(${name})`;
  return Guarded;
}
