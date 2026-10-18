"use client";

import { Camera, IdCard, Trash2, User } from 'lucide-react';
import { Avatar, DatePicker, Field } from '@/app/components/ui';
import { COUNTRIES } from '../../lib/countries';
import { useStaffFormContext } from "../StaffFormContext";
import { Choice, Row, Section, SelectField, TextField } from '../parts';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function PersonalTab() {
  const { form, errors, fileRef, errorMessage, photoPreview, isMY, isNonMY, change, handleFileChange, removePhoto } = useStaffFormContext();
  const name = `${form.firstName} ${form.lastName}`.trim();
  return (
    <div className='space-y-8'>
      {/* Photo */}
      <div className='flex items-center gap-4 rounded-2xl border border-line bg-surface-2/50 p-4'>
        <label className='group relative shrink-0 cursor-pointer' title='Choose a photo'>
          {photoPreview ? (
            <img src={photoPreview} alt='' className='size-20 rounded-full object-cover ring-4 ring-surface' />
          ) : name ? (
            <Avatar name={name} size='lg' className='[&>span]:size-20 [&>span]:text-xl' />
          ) : (
            <span className='inline-flex size-20 items-center justify-center rounded-full bg-surface text-subtle ring-1 ring-line'>
              <User className='size-8' aria-hidden='true' />
            </span>
          )}
          <span className='absolute -bottom-0.5 -right-0.5 inline-flex size-8 items-center justify-center rounded-full bg-brand text-brand-fg shadow ring-2 ring-surface transition group-hover:scale-105'>
            <Camera className='size-4' aria-hidden='true' />
          </span>
          <input type='file' accept='image/*' ref={fileRef} onChange={handleFileChange} className='sr-only' />
        </label>
        <div className='min-w-0 space-y-1'>
          <p className='truncate text-base font-semibold text-fg'>{name || 'New staff member'}</p>
          <p className='text-xs text-muted'>A clear face photo helps at the kiosk and in chat.</p>
          <div className='flex items-center gap-3 pt-1'>
            <button type='button' onClick={() => fileRef.current?.click()} className='text-xs font-semibold text-brand hover:underline'>
              {photoPreview ? 'Change photo' : 'Add photo'}
            </button>
            {photoPreview && (
              <button type='button' onClick={removePhoto} className='inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline'>
                <Trash2 className='size-3.5' aria-hidden='true' /> Remove
              </button>
            )}
          </div>
          {errorMessage && <p className='text-xs font-medium text-danger'>{errorMessage}</p>}
        </div>
      </div>

      <Section icon={User} title='About them'>
        <Row>
          <TextField name='firstName' label='First name' required placeholder='Ahmad' autoComplete='off' />
          <TextField name='lastName' label='Last name' required placeholder='Ismail' autoComplete='off' />
        </Row>
        <Row>
          <Choice name='gender' label='Gender' options={GENDERS} />
          <Field label='Date of birth' error={errors.dob}>
            <DatePicker size='lg' max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={v => change({ target: { name: 'dob', value: v } })} />
          </Field>
        </Row>
      </Section>

      <Section icon={IdCard} title='Identity' description='Only managers and the bookkeeper see these. The IC or passport number also signs them in to the staff app.'>
        <SelectField name='nationality' label='Nationality' options={COUNTRIES} />
        <Row>
          {isMY && <TextField name='icNumber' label='IC number (MyKad)' required placeholder='000000-00-0000' inputMode='numeric' />}
          <TextField
            name='passportNumber'
            label='Passport number'
            required={isNonMY}
            optional={!isNonMY}
            placeholder={isNonMY ? 'A12345678' : 'If they have one'}
            hint={!form.nationality ? 'Choose the nationality first — Malaysians need an IC, others a passport.' : undefined}
          />
        </Row>
      </Section>
    </div>
  );
}
