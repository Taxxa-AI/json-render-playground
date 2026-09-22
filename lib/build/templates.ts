/**
 * Starter implementations for the build-component lab.
 *
 * Each one is a single expression — the editor holds exactly what
 * `compileComponent` wraps in `const __Component = ( … );`. They are written
 * against the same `Callout` entry the lab's catalog declares, so switching
 * template never changes the spec.
 *
 * Scope available inside the editor (the `new Function` parameter list):
 *   React, h, Fragment, useBoundProp, useStateValue, useFieldValidation,
 *   cn, Badge, Button, Input
 */

export interface Template {
  id: string;
  label: string;
  /** One line under the chip row. */
  blurb: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'start',
    label: 'start here',
    blurb: 'ignores everything it is handed — the four tasks build it up from this',
    code: `({ props }) => (
  <div className="rounded-md border border-dashed bg-surface px-3 py-3 text-[13px] leading-relaxed text-muted-foreground">
    This component received a full context object and rendered none of it.
    Read the panel on the right, then put <span className="font-mono">props.title</span> on screen.
  </div>
)`,
  },
  {
    id: 'display',
    label: 'display',
    blurb: 'props only — everything is already resolved when your function runs',
    code: `({ props }) => (
  <div className={cn(
    'rounded-md border-l-2 bg-surface px-3 py-2',
    props.tone === 'danger' ? 'border-l-red-500' : 'border-l-orange-500',
  )}>
    <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
      {props.tone ?? 'neutral'}
    </div>
    <div className="text-[15px] font-medium text-foreground">{props.title}</div>
    {props.body && <p className="text-[13.5px] text-muted-foreground">{props.body}</p>}
  </div>
)`,
  },
  {
    id: 'container',
    label: 'container',
    blurb: 'children is the default slot; every other slot arrives by name',
    code: `({ props, children, slots }) => (
  <div className="rounded-md border bg-card">
    <div className="border-b bg-muted px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
      {props.title}
    </div>

    {/* children === the 'default' slot. slots.default is undefined. */}
    <div className="flex flex-col gap-1 px-3 py-2 text-[13.5px]">{children}</div>

    {slots?.actions && (
      <div className="flex items-center gap-2 border-t bg-surface px-3 py-1.5">
        {slots.actions}
      </div>
    )}
  </div>
)`,
  },
  {
    id: 'input',
    label: 'input',
    blurb: 'useBoundProp rejoins props.draft (the value) with bindings.draft (the path)',
    code: `({ props, bindings }) => {
  // props.draft holds the VALUE, bindings.draft holds the PATH it came from.
  // useBoundProp pairs them back up; without the path, setDraft is a no-op.
  const [draft, setDraft] = useBoundProp(props.draft, bindings?.draft);

  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[15px] font-medium text-foreground">{props.title}</div>
      <Input
        className="mt-1.5 h-9 rounded-md"
        value={draft ?? ''}
        placeholder="type here — this writes to /form/draft"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
        bindings.draft = {bindings?.draft ?? '(none — prop is not $bindState)'}
      </div>
    </div>
  );
}`,
  },
  {
    id: 'button',
    label: 'button',
    blurb: "emit('press') resolves element.on.press — a no-op when nothing is bound",
    code: `({ props, emit, on }) => {
  // on() is the same event with metadata attached.
  const press = on('press');

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <span className="text-[15px] font-medium text-foreground">{props.title}</span>
      <Badge variant={press.bound ? 'secondary' : 'outline'} className="font-mono text-[10px]">
        {press.bound ? 'press is bound' : 'press is unbound'}
      </Badge>
      <Button size="sm" className="ml-auto h-7" onClick={() => emit('press')}>
        emit('press')
      </Button>
    </div>
  );
}`,
  },
  {
    id: 'broken',
    label: 'broken',
    blurb: 'throws on purpose — the guard turns one dead component into one red box',
    code: `({ props }) => {
  // props.tags was never declared on this entry, so it is undefined, and
  // .join on undefined throws. This is the ordinary shape of the bug: a prop
  // the model emitted, or forgot to, that your code assumed was there.
  return <div>{props.title}: {props.tags.join(', ')}</div>;
}`,
  },
];

/** The lab opens on the empty starter so its tasks are real work, not a tour. */
export const DEFAULT_TEMPLATE = TEMPLATES[0];
