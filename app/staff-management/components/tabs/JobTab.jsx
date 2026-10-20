"use client";

import { Briefcase, NotebookPen } from 'lucide-react';
import { DatePicker, Field, Select } from '@/app/components/ui';
import useSession from '@/app/hooks/useSession';
import { useChatPeople } from '@/app/components/chat/useChat';
import { ROLES } from '../../lib/constants';
import { useStaffFormContext } from "../StaffFormContext";
import { Choice, Row, Section, TextField } from '../parts';

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
        <Choice name='role' label='Role' required options={ROLES.filter(r => r.value)} />
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
