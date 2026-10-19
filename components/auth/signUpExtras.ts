/**
 * Shape the RegisterModal extras the way useAuth.signUp reads them: general.* and contact.phone
 * (signUp ignores flat fullName/phone/gender/dateOfBirth/nationality). Empty values are left out —
 * Firestore rejects nested undefined fields and signUp only strips top-level undefined.
 * Pure (no Firebase import) so it can be unit-tested.
 */
export function buildSignUpExtras(
  form: { fullName: string; gender: string; dateOfBirth: string; nationality: string; phone: string },
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  const general: Record<string, string> = {};
  if (form.fullName.trim()) general.fullName = form.fullName.trim();
  if (form.gender) general.gender = form.gender;
  if (form.dateOfBirth) general.dob = form.dateOfBirth;
  if (form.nationality) general.nationality = form.nationality;
  const contact: Record<string, string> = {};
  if (form.phone.trim()) contact.phone = form.phone.trim();
  return { general, contact, ...extras };
}
