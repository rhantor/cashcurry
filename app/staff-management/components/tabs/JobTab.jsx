"use client";

import { Briefcase, NotebookPen } from 'lucide-react';
import { DatePicker, Field } from '@/app/components/ui';
import { ROLES } from '../../lib/constants';
import { useStaffFormContext } from "../StaffFormContext";
import { Choice, Row, Section, TextField } from '../parts';

// Suggestions for the department box; anything else can be typed.
const DEPARTMENTS = ['Kitchen', 'Front', 'Bar', 'Delivery', 'Cleaning', 'Office'];

export default function JobTab() {
  const { form, errors, change } = useStaffFormContext();
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
