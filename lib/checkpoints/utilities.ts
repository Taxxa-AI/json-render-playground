import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * Utilities — validate, repair, convert.
 *
 * Verified with scratchpad/verify-checkpoints.ts (U1–U8, F2–F5, D21–D23) and
 * verify-checkpoints-2.ts (F9–F13, U9) against @json-render/core 0.20.0:
 * `validateSpec`, `autoFixSpec`, `nestedToFlat`, `deepMergeSpec`,
 * `diffToPatches`, `formatSpecIssues`, `isNonEmptySpec`.
 */
export const utilitiesQuiz: Quiz = {
  group: 'Utilities',
  slug: 'utilities',
  intro: 'The core helpers that stand between a model\'s output and your renderer.',
  questions: [
    {
      kind: 'spot',
      id: 'u-repeat-no-children',
      prompt: 'This list repeats over /tasks. Which issue does validateSpec report?',
      // Verified: ['repeat_without_children'] (D22).
      spec: {
        root: 'list',
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: [],
            repeat: { statePath: '/tasks', key: 'id' },
          },
        },
      } as unknown as Spec,
      options: [
        'repeat_without_children',
        'repeat_state_mismatch',
        'empty_spec',
        'no issue — it renders wrong silently',
      ],
      answer: 0,
      explain:
        'repeat repeats the element\'s CHILDREN, once per item — the container itself renders once. With no children there is no per-item template, so the repeat produces nothing at all. The fix is a child element that renders one item, reading fields with { "$item": "field" }.',
      step: 'repair',
      ref: 'el-repeat',
    },
    {
      kind: 'spot',
      id: 'u-repeat-mismatch',
      prompt: 'spec.state has tasks as a number. Which issue does validateSpec report?',
      // Verified: ['repeat_state_mismatch'] (D23). Note this check only runs when
      // spec.state is present — validateSpec has nothing else to compare against.
      spec: {
        root: 'list',
        state: { tasks: 4 },
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row'],
            repeat: { statePath: '/tasks', key: 'id' },
          },
          row: { type: 'Text', props: { value: { $item: 'title' }, tone: null, size: null }, children: [] },
        },
      } as unknown as Spec,
      options: [
        'repeat_state_mismatch',
        'repeat_item_outside_scope',
        'invalid_visible',
        'no issue — it renders wrong silently',
      ],
      answer: 0,
      explain:
        'repeat.statePath must point at an array. validateSpec can only check this when the spec carries sample state — which is exactly the case for generated specs, and exactly why the prompt insists the model include state. At runtime a non-array resolves to [] and the list renders empty.',
      step: 'repair',
      ref: 'util-validatespec',
    },
    {
      kind: 'choice',
      id: 'u-autofix-lossless',
      prompt: 'Which repairs does autoFixSpec make WITHOUT losing anything?',
      // Verified (U2): with { lossy: false } the only fixes were the relocations
      // of visible and on; the dangling child was left alone.
      options: [
        'Moving visible, on, repeat and watch out of props onto the element',
        'Deleting elements that are not reachable from root',
        'Inventing the missing elements a children array points at',
        'Replacing unknown component types with the nearest catalog match',
      ],
      answer: 0,
      explain:
        'The four misplaced-field fixes are pure relocation: nothing is added, nothing is dropped, and the spec means exactly what the author intended. They are safe to apply unconditionally, and they cover the most common generation error by a wide margin.',
      step: 'repair',
      ref: 'util-autofixspec',
    },
    {
      kind: 'choice',
      id: 'u-autofix-lossy',
      prompt: 'autoFixSpec is called with no options on a spec whose card references a child that does not exist. What happens?',
      // Verified (U3, U3b): lossy defaults to TRUE; the dangling key is pruned
      // from children and the fix is recorded with lossy: true.
      options: [
        'The dangling key is pruned from children — lossy defaults to true',
        'Nothing — lossy fixes are opt-in',
        'The missing element is created as an empty Text',
        'It throws, so you notice before shipping',
      ],
      answer: 0,
      explain:
        'lossy defaults to true, which is the wrong default for a repair loop: pruning makes the spec valid by deleting the content the user asked for. Pass { lossy: false } while retries remain so the model regenerates the missing element, and only accept the pruned version as a last resort. fixDetails tells you which fixes were lossy.',
      step: 'repair',
      ref: 'util-autofixspec',
    },
    {
      kind: 'choice',
      id: 'u-formatissues',
      prompt: 'formatSpecIssues is given a list containing only warnings. What do you get back?',
      // Verified (U8): formatSpecIssues([{severity:'warning',…}]) === ''.
      options: [
        'The empty string — it formats errors only',
        'One line per warning, prefixed with "warning:"',
        'The same text as for errors, with a different header',
        'A thrown error — it requires at least one error',
      ],
      answer: 0,
      explain:
        'It exists to build a repair prompt, and you do not re-prompt a model over an unreachable element. Errors come back as a headed bullet list, verbatim from validateSpec — feed exactly that text into the retry. A model told "Element X references child Y which does not exist" fixes it far more reliably than one told to try again.',
      step: 'repair',
      ref: 'util-formatspecissues',
    },
    {
      kind: 'choice',
      id: 'u-isnonempty',
      prompt: 'isNonEmptySpec({ root: "", elements: {} }) returns…',
      // Verified (U7): false.
      options: [
        'false — it is the guard for "the model produced nothing usable"',
        'true — the shape is structurally a Spec',
        'true — root is optional',
        'false, but only because elements is empty',
      ],
      answer: 0,
      explain:
        'It is a type guard for the very first question in a defensive render path: did anything arrive at all? A streamed spec starts life as exactly { root: "", elements: {} }, so this is the check that distinguishes "still empty" from "ready to validate".',
      step: 'repair',
      ref: 'util-isnonemptyspec',
    },
    {
      kind: 'choice',
      id: 'u-nestedtoflat',
      prompt: 'nestedToFlat walks a tree whose nodes have no ids. What keys does the flat spec end up with?',
      // Verified (U1): { root: 'el-0', elements: { 'el-0': …, 'el-1': … },
      // state hoisted from the root node }.
      options: [
        'Generated ones: el-0, el-1, el-2 … in walk order',
        'The component type names, de-duplicated with a suffix',
        'Hashes of each node, so the same tree always produces the same keys',
        'It throws — every node must carry a key',
      ],
      answer: 0,
      explain:
        'It invents keys positionally, and hoists a state field from the root node to spec.state. Positional means unstable: insert a node near the top and every key below it shifts, so never persist a nestedToFlat key or use it as a patch target across conversions.',
      step: 'formats',
      ref: 'util-nestedtoflat',
    },
    {
      kind: 'choice',
      id: 'u-flattotree',
      prompt: 'You have rows from a database with key and parentKey columns. Which helper builds a Spec, and where does it live?',
      // Verified (F8/F8b): flatToTree is exported from @json-render/react and is
      // NOT present on @json-render/core.
      options: [
        'flatToTree, from @json-render/react',
        'flatToTree, from @json-render/core',
        'nestedToFlat, from @json-render/core',
        'defineSchema, from @json-render/core',
      ],
      answer: 0,
      explain:
        'An easy hour to lose: nestedToFlat is in core, flatToTree is in the React package. flatToTree takes a flat LIST whose elements carry key and parentKey, and turns it into the keyed map with children arrays that the renderer wants — the natural shape for rows out of a table.',
      step: 'formats',
      ref: 'util-flattotree',
    },
    {
      kind: 'choice',
      id: 'u-deepmerge',
      prompt: 'deepMergeSpec(base, patch) where patch is { elements: { card: { props: { title: null } } }, tags: ["b"] }. What happens?',
      // Verified (U4, U5): null deletes the key; arrays replace wholesale.
      options: [
        'title is DELETED, and tags is replaced by ["b"] rather than concatenated',
        'title becomes null, and tags becomes the union of both arrays',
        'title is deleted, and tags is concatenated',
        'The whole elements object is replaced',
      ],
      answer: 0,
      explain:
        'RFC 7396 Merge Patch semantics: null means delete, arrays replace atomically, plain objects recurse, everything else replaces. Neither input is mutated. The array rule is the one that bites — you cannot append to a children array with a merge patch.',
      step: 'repair',
      ref: 'util-deepmergespec',
    },
    {
      kind: 'choice',
      id: 'u-difftopatches',
      prompt: 'diffToPatches sees an array whose third element changed. What does it emit?',
      // Verified (U6): objects recurse; arrays are compared shallowly and
      // replaced atomically, so one element change replaces the whole array.
      options: [
        'One replace op for the whole array',
        'One replace op for /array/2',
        'A remove op followed by an add op at index 2',
        'Nothing — arrays are skipped',
      ],
      answer: 0,
      explain:
        'Objects recurse into per-key add / replace / remove ops, but arrays are compared shallowly and swapped whole. For a spec that is usually fine, since elements live in a keyed map, not an array. For a long children list it means a one-item edit ships the whole list.',
      step: 'refine',
      ref: 'util-difftopatches',
    },
  ],
};
