"use client";

import { HeartPulse, MapPin, Phone } from 'lucide-react';
import { STATES_MY } from '../../lib/constants';
import { Row, Section, SelectField, TextField } from '../parts';

export default function ContactTab() {
  return (
    <div className='space-y-8'>
      <Section icon={Phone} title='Reaching them'>
        <Row>
          <TextField
            name='phone'
            label='Mobile number'
            required
            type='tel'
            inputMode='tel'
            placeholder='012-345 6789'
            hint='They sign in to the staff app with this number.'
          />
          <TextField name='email' label='Email' optional type='email' inputMode='email' placeholder='ahmad@email.com' hint='Not needed to sign in.' />
        </Row>
      </Section>

      <Section icon={HeartPulse} title='Emergency contact' description='Who to call if something happens at work.'>
        <Row>
          <TextField name='emergencyContactName' label='Name' placeholder='Siti Rahimah' />
          <TextField name='emergencyContactPhone' label='Phone' type='tel' inputMode='tel' placeholder='012-345 6789' />
        </Row>
      </Section>

      <Section icon={MapPin} title='Home address'>
        <TextField name='addressLine1' label='Street' placeholder='12, Jalan Ampang' />
        <TextField name='addressLine2' label='Unit, building' optional placeholder='Unit 3-2, Menara Ampang' />
        <Row>
          <TextField name='city' label='City' placeholder='Kuala Lumpur' />
          <TextField name='postalCode' label='Postcode' inputMode='numeric' placeholder='50000' />
        </Row>
        <Row>
          <SelectField name='state' label='State' options={STATES_MY} />
          <TextField name='country' label='Country' placeholder='Malaysia' />
        </Row>
      </Section>
    </div>
  );
}
