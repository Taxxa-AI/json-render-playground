/**
 * Cutting `catalog.prompt()` into the pieces a lab wants to show.
 *
 * The prompt is one long string with plain-text section headers. There is no
 * structured accessor, so everything here is string surgery against the
 * headers the library actually emits (verified against
 * `@json-render/core@0.20.0`):
 *
 *   AVAILABLE COMPONENTS (13):
 *
 *   - Card: { title?: string } - A bordered surface… [accepts children; slots: footer]
 *   …
 *
 *   AVAILABLE ACTIONS:
 */

/** The whole AVAILABLE COMPONENTS block, header included. */
export function componentsSection(prompt: string): string {
  // "AVAILABLE COMPONENTS list below" also appears in the fixed preamble, so
  // anchor on a line start followed by " (" or ":".
  const header = /^AVAILABLE COMPONENTS[ (:]/m.exec(prompt);
  if (!header) return prompt;
  const end = prompt.indexOf('AVAILABLE ACTIONS', header.index);
  return prompt.slice(header.index, end === -1 ? undefined : end).trim();
}

/** The single `- Name: {…} - description […]` line for one component. */
export function componentLine(prompt: string, name: string): string | null {
  const section = componentsSection(prompt);
  const line = section.split('\n').find((l) => l.startsWith(`- ${name}: `));
  return line ?? null;
}

/**
 * Every line of the prompt that mentions this component — its own entry plus
 * the generated examples, which pick a component from the catalog and inline
 * its `example` prop values verbatim.
 */
export function mentions(prompt: string, name: string): string[] {
  if (!name) return [];
  return prompt.split('\n').filter((l) => l.includes(`"${name}"`) || l.startsWith(`- ${name}: `));
}

/** The bracketed slot guidance the library appends, e.g. `[accepts children; slots: actions]`. */
export function slotGuidance(line: string | null): string | null {
  if (!line) return null;
  const m = /\[(accepts children|slots:)[^\]]*\]$/.exec(line.trim());
  return m ? m[0] : null;
}
