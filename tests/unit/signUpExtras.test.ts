import { describe, it, expect } from 'vitest';
import { buildSignUpExtras } from '../../components/auth/signUpExtras';

const form = {
  fullName: '  Tan Ah Kow ',
  gender: 'Male',
  dateOfBirth: '1995-07-06',
  nationality: 'Malaysia',
  phone: ' 0123456789 ',
};

describe('buildSignUpExtras', () => {
  it('nests profile fields under general / contact the way useAuth.signUp reads them', () => {
    const out = buildSignUpExtras(form, { personaType: 'Leader', selectedHobbies: ['Golf'] });
    expect(out).toEqual({
      general: { fullName: 'Tan Ah Kow', gender: 'Male', dob: '1995-07-06', nationality: 'Malaysia' },
      contact: { phone: '0123456789' },
      personaType: 'Leader',
      selectedHobbies: ['Golf'],
    });
  });

  it('sends no flat fullName/phone/gender/dateOfBirth/nationality keys', () => {
    const out = buildSignUpExtras(form);
    for (const k of ['fullName', 'phone', 'gender', 'dateOfBirth', 'nationality']) {
      expect(out).not.toHaveProperty(k);
    }
  });

  it('leaves empty values out instead of writing undefined or empty strings', () => {
    const out = buildSignUpExtras({ fullName: ' ', gender: '', dateOfBirth: '', nationality: '', phone: '' });
    expect(out).toEqual({ general: {}, contact: {} });
  });
});
