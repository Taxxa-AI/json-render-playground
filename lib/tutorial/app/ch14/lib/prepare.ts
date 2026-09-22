import { type Spec, type SpecIssue, autoFixSpec, formatSpecIssues, validateSpec } from '@json-render/core';

export interface PreparedSpec {
  /** Safe to hand to <Renderer>. Null when nothing renderable survived. */
  spec: Spec | null;
  /** What was silently repaired. Log these — every one is a prompt bug. */
  fixes: string[];
  /** Remaining problems, already formatted to paste into a repair prompt. */
  report: string;
  ok: boolean;
}

/**
 * Never render a generated spec straight from the wire.
 *
 * A model produces four failures far more often than any other: `visible`,
 * `on` or `repeat` nested inside `props`, and children pointing at elements
 * it never emitted. The first three are relocations, so they are free. The
 * last one deletes content, so it is a last resort.
 */
export function prepareSpec(raw: Spec | null, options: { allowLossy?: boolean } = {}): PreparedSpec {
  if (!raw || !raw.root || Object.keys(raw.elements ?? {}).length === 0) {
    return { spec: null, fixes: [], report: 'The model produced no renderable spec.', ok: false };
  }

  // Pass one: lossless only. `autoFixSpec` returns a COPY, so `raw` is
  // untouched and you can still show the original in a debug pane.
  const lossless = autoFixSpec(raw, { lossy: false });
  let spec = lossless.spec;
  let fixes = [...lossless.fixes];
  let issues = validateSpec(spec, { checkOrphans: true });

  // Pass two, only if you have no retries left. This prunes dangling child
  // references — the page renders, minus whatever the model forgot.
  if (!issues.valid && options.allowLossy) {
    const lossy = autoFixSpec(spec, { lossy: true });
    spec = lossy.spec;
    fixes = [...fixes, ...lossy.fixes];
    issues = validateSpec(spec, { checkOrphans: true });
  }

  // Orphans come back as WARNINGS: unreachable elements are dead weight,
  // not breakage. Only errors decide whether you render.
  const errors: SpecIssue[] = issues.issues.filter((issue) => issue.severity === 'error');

  return {
    spec: errors.length === 0 || options.allowLossy ? spec : null,
    fixes,
    report: issues.issues.length > 0 ? formatSpecIssues(issues.issues) : '',
    ok: errors.length === 0,
  };
}
