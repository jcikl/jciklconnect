// One-time cleanup: remove legacy root-level fields that have been migrated to nested sub-objects
// (general.*, contact.*, others.*, business.*, jciCareer.*).
// Source of truth: MIGRATED_FLAT_FIELDS in services/membersService.ts.
// Fields intentionally kept at root: loId, role, churnRisk, companyName, industry, birthdayMMDD,
//   idealReferralIndustry, skills, tier, mentorId, menteeIds, badges, duesPaidDate, duesStatus,
//   duesYear, fcmToken, fcmUpdatedAt, membership, privacy, surveyAnswers, tendencyTags, personaType,
//   internationalPartnershipTypes, points (kept as leaderboard index), and all nested sub-objects.
//
// GET  → dry-run (count dirty documents and total fields to remove)
// POST → execute (batch FieldValue.delete() across all dirty docs)
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { FieldValue } from 'firebase-admin/firestore';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const MEMBERS_COL = 'members';

const LEGACY_FIELDS = [
  // general.*
  'name', 'fullName', 'chineseName', 'chiName',
  'idNumber', 'nationalId', 'dob', 'dateOfBirth',
  'gender', 'race', 'ethnicity', 'nationality', 'birthPlace', 'dietaryPreference',
  'avatarUrl', 'avatar',
  // contact.*
  'email', 'phone', 'alternatePhone', 'address',
  'whatsappJoined', 'whatsappGroup', 'whatsappgroup',
  'linkedin', 'linkedIn', 'facebook', 'instagram', 'wechat', 'weChat',
  'emergencyContactName', 'emergencyContact', 'emergencyContactPhone', 'emergencyContactRelationship',
  // others.*
  'bio', 'hobbies', 'shirtStyle', 'cutStyle', 'tshirtSize', 'jacketSize', 'embroideredName', 'tshirtStatus',
  // business.*
  'companyWebsite', 'companyLogoUrl', 'introduction', 'companyDescription',
  'businessCategory', 'category', 'specialOffer', 'offerToMember',
  'acceptInternationalBusiness', 'idealReferral', 'idealReferrals', 'connections',
  'levelOfManagement', 'departmentAndPosition', 'interestedIndustries', 'idealReferralTypes', 'bookmarkedBusinessIds',
  'profession', 'title', 'position',
  // jciCareer.*
  'joinDate', 'joinedDate', 'membershipType', 'introducer', 'probationTasks',
  'promotionProgress', 'isDuesPaidCurrentYear',
  'attendanceCheckins', 'attendanceMonths', 'attendanceYear',
  'badgesCount', 'projectsCount', 'trainingsCount', 'careerHistory',
  'senatorCertified', 'senatorshipId', 'senatorshipBoardValidated',
  'currentBoardYear', 'currentBoardPosition', 'isCurrentBoardMember', 'boardHistory',
  'engagementProgress', 'radarStats', 'radarStatsByYear', 'membershipDuesHistory',
  'leaderboardVisibility', 'hasPaidInitiationFee', 'senatorshipValidatedAt', 'senatorshipValidatedBy',
];

async function verifyAdmin(req) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    const snap = await db.collection(MEMBERS_COL).doc(decoded.uid).get();
    const role = snap.data()?.role;
    return ['ADMIN', 'SUPER_ADMIN'].includes(role) ? decoded.uid : null;
  } catch { return null; }
}

export default async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'POST'].includes(req.method)) return new Response('Method Not Allowed', { status: 405, headers: cors });
  if (!hasAdminCredentials) return Response.json({ error: 'Admin credentials not configured' }, { status: 500, headers: cors });

  const callerUid = await verifyAdmin(req);
  if (!callerUid) return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });

  try {
    const membersSnap = await db.collection(MEMBERS_COL).get();

    const toClean = [];
    for (const docSnap of membersSnap.docs) {
      const data = docSnap.data();
      const fields = LEGACY_FIELDS.filter(f => f in data);
      if (fields.length > 0) toClean.push({ ref: docSnap.ref, fields });
    }

    const totalFields = toClean.reduce((sum, d) => sum + d.fields.length, 0);

    if (req.method === 'GET') {
      return Response.json({
        dryRun: true,
        totalMembers: membersSnap.size,
        dirtyDocs: toClean.length,
        totalFields,
        // Sample of fields found across dirty docs (for verification)
        fieldFrequency: LEGACY_FIELDS.reduce((acc, f) => {
          const count = toClean.filter(d => d.fields.includes(f)).length;
          if (count > 0) acc[f] = count;
          return acc;
        }, {}),
      }, { status: 200, headers: cors });
    }

    // POST: batch delete
    let cleaned = 0;
    for (let i = 0; i < toClean.length; i += 500) {
      const batch = db.batch();
      for (const { ref, fields } of toClean.slice(i, i + 500)) {
        const update = {};
        fields.forEach(f => { update[f] = FieldValue.delete(); });
        batch.update(ref, update);
      }
      await batch.commit();
      cleaned += Math.min(500, toClean.length - i);
    }

    console.log(`[cleanup-legacy-fields] by=${callerUid} dirtyDocs=${toClean.length} totalFields=${totalFields} cleaned=${cleaned}`);
    return Response.json({ dryRun: false, cleaned, totalFields }, { status: 200, headers: cors });

  } catch (err) {
    console.error('[cleanup-legacy-fields] error:', err.message);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
};
