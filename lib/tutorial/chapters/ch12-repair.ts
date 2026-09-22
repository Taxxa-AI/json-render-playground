import type { Chapter } from '../types';

export const ch12: Chapter = {
  slug: 'repair',
  n: 12,
  title: 'Validate & repair',
  goal: 'Stop rendering raw model output: one function that fixes what it can and reports what it cannot.',
  minutes: 12,
  why: [
    'Models make a small, repeatable set of structural mistakes. Three of them are misplacement — `visible`, `on` or `repeat` written inside `props` instead of beside it — and one is a dangling reference, a `children` entry naming an element that was never emitted.',
    '`autoFixSpec` handles all four, and splits them by cost. The relocations are LOSSLESS: nothing changes about what renders. Pruning a dangling child is LOSSY: content disappears. That is why the option exists — while you still have a retry left, fix losslessly and re-prompt; only accept the lossy pass as a last resort.',
    '`validateSpec` then tells you what is left, with a machine-readable `code` on every issue and a severity. Orphans are warnings, not errors: an unreachable element is dead weight, not breakage. `formatSpecIssues` turns the list into prose you can paste straight into a repair prompt.',
    'Run it on every frame, not just at the end. A half-streamed spec ALWAYS has dangling children, because the parent patch arrives before its children. Keep `allowLossy` on while streaming and tighten up when the response finishes.',
  ],
  files: [
    { path: 'lib/prepare.ts', lang: 'ts', notes: [] },
    { path: 'app/generate/page.tsx', lang: 'tsx', notes: [] },
  ],
  mistakes: [
    {
      wrong: 'const { spec } = autoFixSpec(raw);   // lossy defaults to true',
      lang: 'ts',
      why: 'The default is lossy. On the first attempt that silently deletes content the model could have regenerated. Pass `{ lossy: false }` while retries remain.',
    },
    {
      wrong: 'if (validateSpec(spec).issues.length > 0) return null;',
      lang: 'ts',
      why: 'Issues include warnings. An orphaned element is a warning and perfectly renderable, so this throws away good pages. Filter on `severity === "error"`.',
    },
    {
      wrong: 'const fixed = autoFixSpec(raw);\nconsole.log(raw);   // expecting the original',
      lang: 'ts',
      why: 'Fine, in fact — `autoFixSpec` returns a corrected COPY and leaves the input alone, so you can keep the raw version for a debug pane. Worth knowing before you defensively deep-clone.',
    },
    {
      wrong: 'const prepared = useMemo(() => prepareSpec(spec), []);',
      lang: 'tsx',
      why: 'Empty dependency array on a value that changes on every patch. The page freezes on the first frame of the stream and never updates again.',
    },
    {
      wrong: 'validateSpec(spec, { checkOrphans: true })   // in a hot render path',
      lang: 'ts',
      why: 'Orphan detection walks the whole tree from the root. Fine per frame at this size, worth measuring at a thousand elements — and it defaults to off for exactly that reason.',
    },
  ],
  tryIt: {
    instruction: 'The preview feeds deliberately broken specs through `prepareSpec`. Switch between them and read the fixes and the report.',
    check: 'You can tell, for each broken spec, whether it was repaired losslessly, repaired lossily, or refused.',
  },
  refs: ['util-validatespec', 'util-autofixspec'],
  steps: ['repair', 'limitations'],
};
