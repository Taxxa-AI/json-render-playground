import { ActionLab } from '@/components/lab/action-lab';
import { Code, Facts, Gotcha, Gotchas } from '@/components/playground/ui';
import { StepPage } from '@/components/shell/step-page';
import { StepRef } from '@/components/shell/step-ref';

export default function Page() {
  return (
    <StepPage
      slug="actions"
      lab={<ActionLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>
        A spec cannot hold code, so behaviour works by naming: component emits → element&rsquo;s <code>on</code>{' '}
        maps it to an action → runtime dispatches. The lab walks this in seven tabs — five for <code>on</code>, two
        for <code>watch</code>. The <strong>your app code</strong> pane holds the host side: the{' '}
        <code>JSONUIProvider</code> call, the handlers map it is given, and the library functions that read them.
      </p>

      <h3>1 · on</h3>
      <Code lang="json" title="one event, one action">{`{
  "type": "Button",
  "props": { "label": "notify", "variant": "secondary" },
  "on": { "press": { "action": "notify", "params": { "message": "plain dispatch" } } }
}`}</Code>
      <p>
        <code>emit(name)</code> is a no-op when nothing is bound, so a component never needs to know whether anyone
        is listening. Params here are resolved by <code>resolveActionParam</code> — full prop resolution, so{' '}
        <code>$state</code>, <code>$item</code>, <code>$index</code>, <code>$cond</code>, <code>$template</code> and
        arrays all work.
      </p>

      <h3>2 · the four built-ins</h3>
      <Code lang="json" title="no declaration, no handler">{`{ "action": "setState",     "params": { "statePath": "/tab", "value": "b" } }
{ "action": "pushState",    "params": { "statePath": "/tasks",
                                        "value": { "id": "$id", "title": { "$state": "/draft" } },
                                        "clearStatePath": "/draft" } }
{ "action": "removeState",  "params": { "statePath": "/tasks", "index": { "$index": true } } }
{ "action": "validateForm", "params": { "statePath": "/result" } }`}</Code>
      <p>
        <code>$id</code> expands to a fresh unique id inside a <code>pushState</code> value.{' '}
        <code>clearStatePath</code> empties an input in the same dispatch — the add-a-todo pattern.{' '}
        <code>ActionProvider</code> also handles <code>push</code> / <code>pop</code>, a nav stack over{' '}
        <code>/currentScreen</code> and <code>/navStack</code>; they are not in the prompt, so no model emits them.
      </p>

      <h3>3–4 · confirm, onSuccess, onError</h3>
      <Code lang="json" title="everything a binding can carry">{`{
  "action": "deleteAll",
  "params":  { "id": { "$state": "/selected" } },
  "confirm": { "title": "Delete?", "message": "…", "variant": "danger" },
  "onSuccess": { "set": { "/status": "deleted" } },     // or { action, params }
  "onError":   { "action": "notify", "params": { "message": "Failed." } },
  "preventDefault": true
}`}</Code>
      <p>
        Params on <code>onSuccess</code> / <code>onError</code> go through <code>resolveAction</code>, not the
        renderer: <strong>only</strong> <code>{'{ $state }'}</code> is understood there. Anything richer reaches
        your handler raw. <code>onSuccess</code> also accepts <code>{'{ navigate: "/path" }'}</code>, which calls
        the <code>navigate</code> prop you gave the provider; <code>onError</code> does not.
      </p>
      <p>
        The dialog is <code>ConfirmDialog</code>, rendered by <code>ConfirmationDialogManager</code>, which{' '}
        <code>JSONUIProvider</code> mounts as a sibling of your children. It is hardcoded there — not a prop — so
        swapping it means building the provider stack by hand. <code>resolveAction</code> interpolates{' '}
        <code>$&#123;/path&#125;</code> in <code>confirm.title</code> and <code>confirm.message</code>.
      </p>

      <h3>5 · arrays</h3>
      <Code lang="json" title="an array runs in order, each awaited">{`"on": { "press": [ { "action": "validateForm" }, { "action": "submit" } ] }`}</Code>

      <h3>6 · watch</h3>
      <Code lang="json" title="a sibling of props/children, never inside props">{`{
  "type": "Select",
  "props": { "label": "Country", "value": { "$bindState": "/form/country" }, "options": [ … ] },
  "watch": {
    "/form/country": { "action": "setState",
                       "params": { "statePath": "/cities", "value": { "$cond": … } } }
  },
  "children": []
}

// Fires on CHANGE only — never on the first render.
// ONE binding per entry: see the gotcha below. To chain steps, let each
// element watch the path the step before it wrote.`}</Code>

      <h3>7 · loops</h3>
      <p>
        <code>/a</code> writes <code>/b</code>, <code>/b</code> writes <code>/a</code>. Both writing constants
        converges after three dispatches, because <code>set</code> returns early on an unchanged value. Either side
        writing something new each hop — a <code>$template</code>, a counter, a fresh array — never terminates, and
        nothing detects it.
      </p>

      <Facts
        rows={[
          { k: <code key="a">emit(name)</code>, v: 'No-op when unbound, so components never need to know if anyone is listening.' },
          { k: <code key="b">$id</code>, v: <>Inside a <code key="c">pushState</code> value, expands to a fresh unique id.</> },
          { k: <code key="d">clearStatePath</code>, v: 'Empties an input in the same dispatch — the add-a-todo pattern.' },
          { k: 'params on on/watch', v: <>Resolved by <code key="e">resolveActionParam</code>: full prop resolution — <code key="f">$state</code>, <code key="g">$item</code>, <code key="h">$index</code>, <code key="i">$cond</code>, <code key="j">$template</code>, arrays.</> },
          { k: 'params on onSuccess', v: <>Resolved by <code key="k">resolveAction</code>: <strong key="l">only</strong> <code key="m">{'{ $state }'}</code>. Anything else arrives raw.</> },
          { k: <code key="v">$error.message</code>, v: <>That exact string as a value in an <code key="w">onError</code> <code key="x">set</code> is replaced with the thrown message. Only there.</> },
          { k: <code key="y">$id</code>, v: <>Expanded by <code key="z">deepResolveValue</code>, which only <code key="aa">pushState</code> calls. It is not a general expression.</> },
          { k: 'the dialog', v: <><code key="ab">ConfirmDialog</code>, mounted by <code key="ac">ConfirmationDialogManager</code> inside <code key="ad">JSONUIProvider</code>. Inline styles, hardcoded, not swappable by prop.</> },
          { k: <code key="n">watch</code>, v: <>Map of state path → binding(s). Compared per render, fired on change, skipped on mount. Cascading selects, resetting dependents.</> },
          { k: 'watch arrays', v: <>Unreliable past the first binding that writes state — the write cancels the effect that is running them. One binding per entry.</> },
          { k: 'watch values', v: <>Compared with <code key="o">!==</code>. A fresh array or object is always &ldquo;changed&rdquo;, even if deep-equal.</> },
          { k: 'a handler', v: <>Is <code key="p">(params) =&gt; Promise&lt;unknown&gt;</code> and nothing more. No setState, no store — see <StepRef key="q" slug="build-check" />.</> },
          { k: 'undocumented', v: <><code key="r">push</code>/<code key="s">pop</code> — a nav stack over <code key="t">/currentScreen</code> and <code key="u">/navStack</code>. Not in the prompt, so no model emits them.</> },
        ]}
      />

      <Gotchas>
        <Gotcha><strong>Built-ins ignore confirm, onSuccess and onError.</strong> They <code>return</code> before the
            confirm branch, so <code>{'{ "action": "removeState", "confirm": {…} }'}</code> deletes with no dialog.
            Route confirmed deletes through a custom action.</Gotcha>
        <Gotcha><strong>A confirmed action settles before it runs.</strong> <code>execute</code> returns the pending
            confirm promise from inside a <code>try/finally</code>, and a <code>finally</code> runs when a promise is
            returned, not when it resolves. The settle event fires ~1ms after dispatch with <code>ok: true</code>,
            before the user answers. Cancel it and the timeline still shows success — the cancel arrives as an
            unhandled rejection (<code>Error(&quot;Action cancelled&quot;)</code>) that nothing in the renderer
            catches. Observer timings are only reliable for unconfirmed actions.</Gotcha>
        <Gotcha><strong>An <code>onError</code> hides the failure from the timeline.</strong>{' '}
            <code>executeAction</code> rethrows <em>only</em> in the <code>else</code> of its catch — so a binding
            with an <code>onError</code> swallows the rejection, <code>execute</code> never sees it, and the
            observer reports <code>ok: true</code> for an action that threw. Drop the <code>onError</code> and the
            same throw escapes the renderer entirely: <code>Renderer.emit</code> does not catch, so it lands on{' '}
            <code>window</code> as an unhandled rejection. Under <code>watch</code> it differs again — that effect
            ends in <code>.catch(console.error)</code>.</Gotcha>
        <Gotcha><strong>Built-ins never reach your <code>handlers</code> map.</strong> To audit state mutation, wrap
            the <code>StateStore</code>, not the handlers — see <StepRef slug="stores" />.</Gotcha>
        <Gotcha><strong>Watchers loop, and only the store stops them.</strong> Of every field in a spec, this is the
            one to strip from model output before you trust it (<StepRef slug="limitations" />).</Gotcha>
        <Gotcha><strong>An array of watch bindings silently drops its tail.</strong> The effect&rsquo;s cleanup
            sets a <code>cancelled</code> flag, and its dependencies include a context object that{' '}
            <code>VisibilityProvider</code> rebuilds on <em>every</em> state change — so the first binding that
            actually writes state tears down its own effect, and every binding queued behind it is skipped. A watch
            array therefore runs reliably only up to <em>and including</em> its first state-changing binding.
            Measured in a DOM: <code>[reset, fill, loadCities]</code> fires two of three, every time, with latency
            on or off. Nothing warns — <code>validateSpec</code> is clean and no message is logged. Keep one
            binding per <code>watch</code> entry and chain the steps by having each element watch the path the
            previous step wrote.</Gotcha>
      </Gotchas>
    </StepPage>
  );
}
