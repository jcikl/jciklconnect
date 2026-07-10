// Malaysian IC (MyKad) utilities

const STATE_CODE_MAP: Record<string, string> = {
  '01': 'Johor',
  '21': 'Johor',
  '22': 'Johor',
  '23': 'Johor',
  '24': 'Johor',
  '02': 'Kedah',
  '25': 'Kedah',
  '26': 'Kedah',
  '27': 'Kedah',
  '03': 'Kelantan',
  '28': 'Kelantan',
  '29': 'Kelantan',
  '04': 'Melaka',
  '30': 'Melaka',
  '05': 'Negeri Sembilan',
  '31': 'Negeri Sembilan',
  '59': 'Negeri Sembilan',
  '06': 'Pahang',
  '32': 'Pahang',
  '33': 'Pahang',
  '07': 'Pulau Pinang',
  '34': 'Pulau Pinang',
  '35': 'Pulau Pinang',
  '08': 'Perak',
  '36': 'Perak',
  '37': 'Perak',
  '38': 'Perak',
  '39': 'Perak',
  '09': 'Perlis',
  '40': 'Perlis',
  '10': 'Selangor',
  '41': 'Selangor',
  '42': 'Selangor',
  '43': 'Selangor',
  '44': 'Selangor',
  '11': 'Terengganu',
  '45': 'Terengganu',
  '46': 'Terengganu',
  '12': 'Sabah',
  '47': 'Sabah',
  '48': 'Sabah',
  '49': 'Sabah',
  '13': 'Sarawak',
  '50': 'Sarawak',
  '51': 'Sarawak',
  '52': 'Sarawak',
  '53': 'Sarawak',
  '14': 'Kuala Lumpur',
  '54': 'Kuala Lumpur',
  '55': 'Kuala Lumpur',
  '56': 'Kuala Lumpur',
  '57': 'Kuala Lumpur',
  '15': 'Wilayah Persekutuan (Labuan)',
  '58': 'Wilayah Persekutuan (Labuan)',
  '16': 'Wilayah Persekutuan (Putrajaya)',
  '82': 'Negeri Tidak Diketahui',
};

/**
 * Derives birth place (state) from a Malaysian IC number.
 * IC format: YYMMDDSSNNNN (12 digits, hyphens optional).
 * Digits 7-8 (0-indexed: 6-7) are the state code.
 * Returns empty string if IC is not a valid Malaysian format.
 */
export function getBirthPlaceFromIC(ic: string): string {
  const digits = ic.replace(/[-\s]/g, '');
  if (digits.length !== 12 || !/^\d{12}$/.test(digits)) return '';
  const stateCode = digits.slice(6, 8);
  return STATE_CODE_MAP[stateCode] ?? '';
}

/**
 * Returns true if the IC looks like a Malaysian MyKad (12 digits).
 */
export function isMalaysianIC(ic: string): boolean {
  const digits = ic.replace(/[-\s]/g, '');
  return digits.length === 12 && /^\d{12}$/.test(digits);
}

/**
 * Derives gender from last digit of IC: odd = Male, even = Female.
 */
export function getGenderFromIC(ic: string): 'Male' | 'Female' | '' {
  const digits = ic.replace(/[-\s]/g, '');
  if (digits.length !== 12 || !/^\d{12}$/.test(digits)) return '';
  return parseInt(digits[11], 10) % 2 === 1 ? 'Male' : 'Female';
}

/**
 * Derives date of birth (YYYY-MM-DD) from first 6 digits of IC.
 * Uses sliding-window century: YY <= current year's last 2 digits → 20xx, else 19xx.
 * Returns empty string if date is invalid.
 */
export function getDateOfBirthFromIC(ic: string): string {
  const digits = ic.replace(/[-\s]/g, '');
  if (digits.length !== 12 || !/^\d{12}$/.test(digits)) return '';
  const yy = parseInt(digits.slice(0, 2), 10);
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const currentYY = new Date().getFullYear() % 100;
  const yyyy = yy <= currentYY ? 2000 + yy : 1900 + yy;
  return `${yyyy}-${mm}-${dd}`;
}
