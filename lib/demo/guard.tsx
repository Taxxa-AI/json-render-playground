'use client';

import { Component, type ComponentType, type ReactNode } from 'react';

/**
 * Per-component error isolation.
 *
 * Step 3 argues you should wrap every registry component defensively, so this
 * playground does it. Without it, one component that throws on a malformed
 * prop blanks the entire page — and with AI-generated specs a prop can be any
 * shape the model felt like emitting, whatever your Zod schema said.
 *
 * SUBTLETY, easy to get wrong: an error boundary only catches errors thrown by
 * its CHILDREN during render, never by its own render. So the guard has to
 * render `<Impl {...props} />` as a child element. Calling `Impl(props)` inline
 * puts the throw inside the boundary's own render and it escapes to the page.
 */
class Boundary extends Component<{ name: string; children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.message !== null) {
      return (
        <span
          title={this.state.message}
          className="inline-block rounded-sm border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {this.props.name} threw
        </span>
      );
    }
    return this.props.children;
  }
}

/** Wrap every entry of a component map in its own boundary. */
export function guardAll<T extends Record<string, unknown>>(components: T): T {
  const out: Record<string, unknown> = {};
  for (const [name, Impl] of Object.entries(components)) {
    const Inner = Impl as ComponentType<Record<string, unknown>>;
    const Guarded = (props: Record<string, unknown>) => (
      <Boundary name={name}>
        <Inner {...props} />
      </Boundary>
    );
    Guarded.displayName = `Guarded(${name})`;
    out[name] = Guarded;
  }
  return out as T;
}
