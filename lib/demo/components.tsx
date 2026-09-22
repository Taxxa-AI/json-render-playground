'use client';

import { useBoundProp, useFieldValidation } from '@json-render/react';
import type { Components } from '@json-render/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Checkbox as ShadCheckbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { demoCatalog } from './catalog';

/**
 * THE REGISTRY IMPLEMENTATIONS — deliberately just shadcn components.
 *
 * This is the realistic shape of a json-render integration: your registry is a
 * thin adapter from catalog names onto the design system you already have. You
 * do not build a second component library for the renderer.
 *
 * Every component receives ONE object, not a props spread:
 *   { props, children, slots, emit, on, loading, bindings }
 *
 * `props` is already RESOLVED — every {"$state"} / {"$cond"} / {"$template"}
 * has been evaluated before your function runs. That is why these are ordinary
 * React components you could unit-test without json-render at all.
 *
 * The one exception is two-way binding: a {"$bindState": "/x"} prop resolves to
 * the current VALUE in `props`, and the PATH it came from in `bindings.<prop>`.
 * `useBoundProp` pairs them back up.
 */

/**
 * Functional hues, per .claude/skills/taxxa-design:
 *   red = destructive/urgency · blue = shared/info · emerald = success · yellow = attention
 * Badge tint formula: border-{hue}-200 bg-{hue}-50 text-{hue}-700 → dark 900/950/300.
 * Full literal strings — Tailwind JIT cannot see template-built class names.
 */
const TONE_TEXT: Record<string, string> = {
  neutral: 'text-foreground',
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger: 'text-red-600 dark:text-red-400',
};

const TONE_BADGE: Record<string, string> = {
  neutral: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warning:
    'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
};

const GAP: Record<string, string> = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' };
const ALIGN: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

/** Shared field chrome: mono micro-label above a shadcn control. */
function Field({
  label,
  required,
  help,
  error,
  children,
}: {
  label: string;
  required?: boolean | null;
  help?: string | null;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {children}
      {help && !error?.length ? <span className="text-[12px] text-muted-foreground">{help}</span> : null}
      {error?.map((e) => (
        <span key={e} className="text-[12px] font-medium text-red-600 dark:text-red-400">
          {e}
        </span>
      ))}
    </div>
  );
}

export const demoComponentImpls: Components<typeof demoCatalog> = {
  Screen: ({ props, children }) => (
    <div className="flex flex-col gap-4">
      {(props.title || props.subtitle) && (
        <div className="flex flex-col gap-0.5">
          {props.title && (
            <h1 className="font-mono text-base font-semibold leading-none tracking-tight text-foreground">
              {props.title}
            </h1>
          )}
          {props.subtitle && <p className="text-xs text-muted-foreground">{props.subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  ),

  Stack: ({ props, children }) => (
    <div
      className={cn(
        'flex',
        props.direction === 'row' ? 'flex-row' : 'flex-col',
        GAP[props.gap] ?? 'gap-4',
        props.align && ALIGN[props.align],
        props.wrap && 'flex-wrap',
      )}
    >
      {children}
    </div>
  ),

  // `children` IS the default slot — there is no slots.default.
  // Named slots arrive in `slots.<name>`, already rendered.
  Card: ({ props, children, slots }) => (
    <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-none">
      {(props.title || props.subtitle) && (
        <CardHeader className="gap-0 border-b bg-muted px-4 py-2.5">
          {props.title && <div className="font-mono text-[14px] font-semibold text-foreground">{props.title}</div>}
          {props.subtitle && <div className="text-xs text-muted-foreground">{props.subtitle}</div>}
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3 px-4 py-3.5">{children}</CardContent>
      {slots?.footer && <CardFooter className="border-t bg-muted px-4 py-2.5">{slots.footer}</CardFooter>}
    </Card>
  ),

  Heading: ({ props }) => (
    <div
      className={cn(
        'font-mono text-foreground',
        props.level === '1'
          ? 'text-lg font-semibold tracking-tight'
          : props.level === '2'
            ? 'text-sm font-semibold'
            : 'text-[12px] font-medium uppercase tracking-wide text-muted-foreground',
      )}
    >
      {props.text}
    </div>
  ),

  /**
   * `value` is declared as a string, but an unresolved expression arrives as an
   * OBJECT — an unregistered directive passes straight through, which is a
   * lesson several pages here teach on purpose. Rendering that object directly
   * makes React throw "Objects are not valid as a React child" and takes the
   * whole page down with it, so the demonstration becomes a 500 instead of a
   * demonstration. Showing the JSON is what those pages claim the component
   * receives, and it cannot be mistaken for a working directive.
   */
  Text: ({ props }) => (
    <p
      className={cn(
        'leading-relaxed',
        props.size === 'sm' ? 'text-xs' : props.size === 'lg' ? 'text-base' : 'text-sm',
        TONE_TEXT[props.tone ?? 'neutral'] ?? 'text-foreground',
      )}
    >
      {typeof props.value === 'object' && props.value !== null ? JSON.stringify(props.value) : props.value}
    </p>
  ),

  Badge: ({ props }) => (
    <Badge
      variant="outline"
      className={cn('w-fit rounded-sm text-[11px] uppercase tracking-wide', TONE_BADGE[props.tone ?? 'neutral'])}
    >
      {props.label}
    </Badge>
  ),

  Metric: ({ props }) => (
    <div className="flex flex-col gap-0.5 rounded-md border bg-surface px-3.5 py-3">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{props.label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">{props.value}</span>
      {props.delta && (
        <span className={cn('text-xs font-medium', TONE_TEXT[props.tone ?? 'neutral'] ?? 'text-muted-foreground')}>
          {props.delta}
        </span>
      )}
    </div>
  ),

  Alert: ({ props }) => (
    <div className={cn('rounded-md border px-3.5 py-2.5', TONE_BADGE[props.tone ?? 'info'])}>
      <div className="font-mono text-[14px] font-semibold">{props.title}</div>
      {props.message && <div className="mt-0.5 text-xs opacity-90">{props.message}</div>}
    </div>
  ),

  // `emit("press")` fires the event named in the element's `on` field.
  // Unbound, it is a harmless no-op — components never need to know.
  Button: ({ props, emit }) => {
    const variant =
      props.variant === 'primary'
        ? ('action' as const) // the one orange moment
        : props.variant === 'danger'
          ? ('destructive' as const)
          : props.variant === 'ghost'
            ? ('ghost' as const)
            : ('outline' as const);
    return (
      <Button type="button" variant={variant} size="sm" className="w-fit" onClick={() => emit('press')}>
        {props.label}
      </Button>
    );
  },

  TextInput: ({ props, bindings }) => {
    const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);

    // Registering is what makes the built-in validateForm action able to see
    // this field. A control that never calls this is invisible to validateAll().
    const validation = useFieldValidation(bindings?.value ?? `unbound:${props.label}`, {
      checks: (props.checks ?? []).map((c) => ({
        type: c.type,
        message: c.message,
        ...(c.args ? { args: c.args as Record<string, never> } : {}),
      })),
      validateOn: 'blur',
    });
    const errors = validation.state.validated ? validation.errors : [];

    return (
      <Field label={props.label} required={props.required} help={props.help} error={errors}>
        <Input
          className={cn('h-9 rounded-md', errors.length && 'border-red-500 focus-visible:ring-red-500')}
          placeholder={props.placeholder ?? ''}
          value={value ?? ''}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            validation.touch();
            validation.validate();
          }}
        />
      </Field>
    );
  },

  Checkbox: ({ props, bindings }) => {
    const [checked, setChecked] = useBoundProp<boolean>(props.checked as boolean, bindings?.checked);
    return (
      <Label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-normal text-foreground">
        <ShadCheckbox checked={Boolean(checked)} onCheckedChange={(v) => setChecked(v === true)} />
        {props.label}
      </Label>
    );
  },

  Select: ({ props, bindings }) => {
    const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);
    return (
      <Field label={props.label}>
        <Select value={value ?? ''} onValueChange={setValue}>
          <SelectTrigger className="h-9 rounded-md">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(props.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  },

  Divider: () => <Separator />,
};
