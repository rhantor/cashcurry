"use client";

import { Briefcase, NotebookPen } from 'lucide-react';
import { useState } from 'react';
import { DatePicker, Field, Input, Select } from '@/app/components/ui';
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice';
import useSession from '@/app/hooks/useSession';
import { useChatPeople } from '@/app/components/chat/useChat';
import { ROLES, ROLE_GROUPS } from '../../lib/constants';
import { WEEKDAYS } from '@/lib/tasks/model';
import { format } from 'date-fns';
import { useStaffFormContext } from "../StaffFormContext";
import { Label, Row, Section, TextField } from '../parts';

const LISTED = new Set(ROLES.map(r => r.value).filter(Boolean));
const OTHER = '__other';

/**
 * Their job: the restaurant's usual ones in groups, the ones typed in before
 * for this branch's staff, or "Other…" to type a new one.
 */
function RoleField() {
  const { form, errors, change } = useStaffFormContext();
  const { companyId, branchId } = useSession();
  const { data: staffList = [] } = useGetStaffListQuery({ companyId, branchId }, { skip: !companyId || !branchId });
  const used = [...new Set(staffList.map(s => String(s.role || '').trim()).filter(v => v && !LISTED.has(v)))].sort((a, b) => a.localeCompare(b));
  const value = form.role || '';
  const known = !value || LISTED.has(value) || used.includes(value);
  const [typing, setTyping] = useState(!known);
  const set = v => change({ target: { name: 'role', value: v } });
  return (
    <Field label={<Label text='Role' required />} hint='Their job at the restaurant. Not on the list? Choose Other and type it.' error={errors.role}>
      {({ id, invalid }) => (
        <div className='space-y-2'>
          <Select
            id={id}
            invalid={invalid}
            value={typing ? OTHER : value}
            onChange={e => {
              const v = e.target.value;
              if (v === OTHER) {
                setTyping(true);
                set('');
              } else {
                setTyping(false);
                set(v);
              }
            }}
            className='h-12'
          >
            <option value=''>Choose…</option>
            {ROLE_GROUPS.map(([group, roles]) => (
              <optgroup key={group} label={group}>
                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </optgroup>
            ))}
            {used.length > 0 && (
              <optgroup label='Added at this branch'>
                {used.map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            )}
            <option value={OTHER}>Other — type it…</option>
          </Select>
          {typing && <Input size='lg' autoFocus value={value} invalid={invalid} onChange={e => set(e.target.value)} placeholder='e.g. Pizza maker, Shawarma master' aria-label='Role' maxLength={40} />}
        </div>
      )}
    </Field>
  );
}

// Suggestions for the department box; anything else can be typed.
const DEPARTMENTS = ['Kitchen', 'Front', 'Bar', 'Delivery', 'Cleaning', 'Office'];

export default function JobTab() {
  const { form, errors, change } = useStaffFormContext();
  // the branch's supervisors: who leads this person's work and gives them tasks (4.11)
  const { companyId, branchId } = useSession();
  const supervisors = useChatPeople(companyId).filter(p => p.role === 'supervisor' && p.branchId === branchId);
  const pickSupervisor = uid => {
    const s = supervisors.find(p => p.uid === uid);
    change({ target: { name: 'supervisorUid', value: uid } });
    change({ target: { name: 'supervisorName', value: s?.name || '' } });
  };
  return (
    <div className='space-y-8'>
      <Section icon={Briefcase} title='Their job'>
        <RoleField />
        <Row>
          <TextField name='department' label='Department' placeholder='Kitchen' list='staff-departments' autoComplete='off' />
          <Field label='Started on' error={errors.startDate}>
            <DatePicker size='lg' value={form.startDate} onChange={v => change({ target: { name: 'startDate', value: v } })} />
          </Field>
        </Row>
        <Field label='Supervisor' hint='Gives them tasks and answers their questions. None: any supervisor at the branch can.'>
          {({ id }) => (
            <Select id={id} value={form.supervisorUid || ''} onChange={e => pickSupervisor(e.target.value)} className='h-12'>
              <option value=''>No one in particular</option>
              {supervisors.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              {form.supervisorUid && !supervisors.some(s => s.uid === form.supervisorUid) && <option value={form.supervisorUid}>{form.supervisorName || 'Someone no longer here'}</option>}
            </Select>
          )}
        </Field>
        <Field label='Weekly day off' hint="Their daily tasks go to the supervisor on these days — never counted as missed.">
          {() => (
            <div className='flex flex-wrap gap-1.5' role='group' aria-label='Weekly day off'>
              {[1, 2, 3, 4, 5, 6, 0].map(d => {
                const on = (form.daysOff || []).map(Number).includes(d)
                return (
                  <button
                    key={d}
                    type='button'
                    aria-pressed={on}
                    onClick={() => {
                      change({ target: { name: 'daysOff', value: on ? (form.daysOff || []).filter(x => Number(x) !== d) : [...(form.daysOff || []), d].sort() } })
                      // from today on: past days already given stay as they were
                      change({ target: { name: 'daysOffSince', value: format(new Date(), 'yyyy-MM-dd') } })
                    }}
                    className={`h-10 min-w-12 rounded-xl border px-3 text-sm font-semibold transition ${on ? 'border-brand bg-brand text-brand-fg' : 'border-line text-fg hover:bg-surface-2'}`}
                  >
                    {WEEKDAYS[d]}
                  </button>
                )
              })}
            </div>
          )}
        </Field>
        <datalist id='staff-departments'>
          {DEPARTMENTS.map(d => <option key={d} value={d} />)}
        </datalist>
      </Section>

      <Section icon={NotebookPen} title='Notes' description='Only managers and the bookkeeper see these.'>
        <TextField name='notes' label='Notes' multiline rows={4} placeholder='Anything worth remembering — agreed days off, uniform size…' />
      </Section>
    </div>
  );
}
