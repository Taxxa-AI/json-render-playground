import { ShapeLab } from '@/components/lab/shape-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="shape"
      lab={<ShapeLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>A UI is a JSON document. Here is the whole format — then go break it.</p>

      <Code lang="typescript" title="the entire spec format">{`interface Spec {
  root: string;                          // KEY of the root element
  elements: Record<string, UIElement>;   // FLAT map — not a tree
  state?: Record<string, unknown>;       // seed data (the renderer IGNORES this)
}

interface UIElement {
  type: string;                          // a component name from the catalog
  props: Record<string, unknown>;        // may contain $-expressions
  children?: string[];                   // KEYS of child elements
  slots?: Record<string, string[]>;      // named slots -> child keys
  visible?: VisibilityCondition;
  repeat?: { statePath: string; key?: string };
  on?: Record<string, ActionBinding>;    // event -> action
  watch?: Record<string, ActionBinding>; // state path -> action
}`}</Code>


      <Facts
        rows={[
          { k: 'children are keys', v: 'Not nested objects. The tree is assembled by pointer-chasing from root.' },
          { k: 'why flat', v: <>
              Every element has a stable address (<code key="a">/elements/header</code>), so &ldquo;add an
              element&rdquo; is one JSON Patch line that disturbs nothing else. A nested tree would need{' '}
              <code key="b">/root/children/2/children/0</code> — a path that moves when anything above it does.
              <StepRef slug="streaming" /> is where that pays off.
            </>, },
          { k: 'children vs slots', v: <><code key="c">children</code> IS the default slot. Writing <code key="d">slots.default</code> instead is not an error — the content is delivered there, with a console warning, and a component that reads only <code key="e">children</code> renders nothing.</> },
          { k: 'element vs props', v: <><code key="e">visible</code>, <code key="f">on</code>, <code key="g">repeat</code>, <code key="h">watch</code> sit beside <code key="i">type</code> — never inside <code key="j">props</code>.</> },
        ]}
      />

      <Gotchas>
        <Gotcha>Defining an element does not mount it. Unreachable from <code>root</code> = does not exist (the tree tab flags it).</Gotcha>
        <Gotcha>A dangling child key deletes that branch silently. <code>validateSpec</code> reports <code>missing_child</code>.</Gotcha>
        <Gotcha>An unknown <code>type</code> renders your <code>fallback</code> — or <em>nothing</em> if you did not pass one.</Gotcha>
        <Gotcha><code>spec.state</code> is never read by <code>&lt;Renderer&gt;</code>, despite the AI prompt telling
            the model to fill it. You seed the store — <StepRef slug="state" /> and{' '}
            <StepRef slug="streaming" /> hit this again.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
