'use client'

// Building blocks of the staff form (StaffModal and its steps). Each field
// reads and writes the form through StaffFormContext by its `name`, so a step
// is mostly a list of fields.
import { motion } from 'framer-motion'
import { Field, Input, Select, Textarea, cn } from '@/app/components/ui'
import { spring } from '@/app/components/ui/motion'
import { useStaffFormContext } from './StaffFormContext'

/** A titled group of fields inside a step. */
export function Section ({ icon: Icon, title, description, children, className }) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || description) && (
        <header className='flex items-start gap-3'>
          {Icon && (
            <span className='mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand'>
              <Icon className='size-4' aria-hidden='true' />
            </span>
          )}
          <div className='min-w-0'>
            {title && <h3 className='text-sm font-semibold text-fg'>{title}</h3>}
            {description && <p className='mt-0.5 text-xs text-muted'>{description}</p>}
          </div>
        </header>
      )}
      {children}
    </section>
  )
}

/** Label with a quiet "required" mark. */
export const Label = ({ text, required, optional }) => (
  <>
    {text}
    {required && <span className='ml-0.5 text-danger'>*</span>}
    {optional && <span className='ml-1 font-normal text-subtle'>(optional)</span>}
  </>
)

/**
 * A text field bound to form[name]. `prefix` sits inside the box on the left
 * (a currency, "+60"…); `clean` tidies what is typed (e.g. digits only).
 */
export function TextField ({ name, label, required, optional, hint, prefix, suffix, clean, multiline, className, ...rest }) {
  const { form, errors, change, blur } = useStaffFormContext()
  const value = form[name] ?? ''
  const onChange = e => change({ target: { name, value: clean ? clean(e.target.value) : e.target.value } })
  return (
    <Field label={<Label text={label} required={required} optional={optional} />} hint={hint} error={errors[name]} className={className}>
      {({ id, invalid }) =>
        multiline ? (
          <Textarea id={id} name={name} value={value} onChange={onChange} onBlur={blur} invalid={invalid} {...rest} />
        ) : (
          <div className='relative'>
            {prefix && (
              <span className='pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-medium text-subtle'>{prefix}</span>
            )}
            <Input
              id={id}
              name={name}
              value={value}
              onChange={onChange}
              onBlur={blur}
              invalid={invalid}
              size='lg'
              className={cn(prefix && 'pl-12', suffix && 'pr-20')}
              {...rest}
            />
            {suffix && (
              <span className='absolute inset-y-0 right-2 flex items-center'>{suffix}</span>
            )}
          </div>
        )
      }
    </Field>
  )
}

/** A dropdown bound to form[name]. */
export function SelectField ({ name, label, required, hint, options, placeholder = 'Choose…', className }) {
  const { form, errors, change, blur } = useStaffFormContext()
  return (
    <Field label={<Label text={label} required={required} />} hint={hint} error={errors[name]} className={className}>
      {({ id, invalid }) => (
        <Select id={id} name={name} value={form[name] ?? ''} onChange={change} onBlur={blur} invalid={invalid} className='h-12'>
          <option value=''>{placeholder}</option>
          {options.map(o => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

/**
 * Pick one of a few: pills in a row (wrap on phones). The chosen pill's
 * highlight slides across.
 */
export function Choice ({ name, label, required, hint, options, className }) {
  const { form, errors, change } = useStaffFormContext()
  const value = form[name] ?? ''
  return (
    <Field label={<Label text={label} required={required} />} hint={hint} error={errors[name]} className={className}>
      <div role='radiogroup' className='flex flex-wrap gap-2'>
        {options.map(o => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type='button'
              role='radio'
              aria-checked={on}
              onClick={() => change({ target: { name, value: o.value } })}
              className={cn(
                'relative inline-flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors',
                on ? 'border-brand text-brand' : 'border-line text-fg hover:bg-surface-2'
              )}
            >
              {on && (
                <motion.span
                  layoutId={`choice-${name}`}
                  transition={spring.snappy}
                  className='absolute inset-0 rounded-[11px] bg-brand-soft'
                />
              )}
              <span className='relative inline-flex items-center gap-2'>
                {o.icon && <o.icon className='size-4' aria-hidden='true' />}
                {o.label}
              </span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

/** A whole row that switches a yes/no field on and off. */
export function ToggleRow ({ name, title, description, tone, children }) {
  const { form, change } = useStaffFormContext()
  const on = !!form[name]
  return (
    <div className={cn('rounded-2xl border transition-colors', on ? (tone === 'warning' ? 'border-warning/40 bg-warning-soft/50' : 'border-brand/30 bg-brand-soft/40') : 'border-line bg-surface')}>
      <button
        type='button'
        role='switch'
        aria-checked={on}
        onClick={() => change({ target: { name, value: !on } })}
        className='flex w-full items-center gap-4 px-4 py-3.5 text-left'
      >
        <span className='min-w-0 flex-1'>
          <span className='block text-sm font-semibold text-fg'>{title}</span>
          {description && <span className='mt-0.5 block text-xs text-muted'>{description}</span>}
        </span>
        <span className={cn('relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-brand' : 'bg-line')}>
          <motion.span layout transition={spring.snappy} className={cn('size-5 rounded-full bg-white shadow', on ? 'ml-auto' : 'ml-0')} />
        </span>
      </button>
      {on && children && <div className='border-t border-line/70 px-4 py-3.5'>{children}</div>}
    </div>
  )
}

/** Two (or three) fields side by side on wider screens. */
export const Row = ({ cols = 2, children }) => (
  <div className={cn('grid grid-cols-1 gap-4', cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>{children}</div>
)

/** Keep digits only (PINs, hours). */
export const digits = v => String(v).replace(/\D/g, '')
/** Keep a money / decimal amount: digits and one dot. */
export const decimal = v => String(v).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
