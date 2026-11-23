// One-time (and idempotent) backfill: sync publicBusinessListings for every member.
// Members with shareCardInternationally===true and a companyName get an upserted listing;
// all others get their listing deleted (if one exists).
// GET  → dry-run summary (toCreate, toDelete, toSkip).
// POST → execute.
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { getLiveOffers, todayIso } from '../../utils/specialOffers.mjs';
import { normalizeIdealReferrals } from '../../utils/idealReferrals.mjs';
import { Timestamp } from 'firebase-admin/firestore';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const LISTINGS_COL = 'publicBusinessListings';
const MEMBERS_COL = 'members';

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

function mapMember(id, data) {
  const business = data.business ?? {};
  const general = data.general ?? {};
  const companyName = data.companyName || business.companyName;
  if (!companyName?.trim()) return null;

  const businessCategory = data.businessCategory ?? business.businessCategory;
  const referralTypes = normalizeIdealReferrals(business.idealReferralTypes);
  const idealReferralTypes = referralTypes.length > 0
    ? referralTypes
    : normalizeIdealReferrals(business.idealReferrals ?? data.idealReferral ?? data.idealReferrals);
  const liveOffer = getLiveOffers(data, todayIso())[0];

  return {
    id,
    memberId: id,
    ownerName: data.name || general.name || general.fullName || 'Unknown',
    companyName,
    industry: data.industry || business.industry || 'Other',
    description: business.companyDescription || data.companyDescription || business.introduction || '',
    website: data.companyWebsite || business.companyWebsite || '',
    offer: liveOffer?.description ?? '',
    offerTerms: liveOffer?.terms ?? '',
    offerExpiry: liveOffer?.expiryDate ?? '',
    logo: data.companyLogoUrl || business.companyLogoUrl || '',
    businessCategory: Array.isArray(businessCategory) ? businessCategory.join(', ') : (businessCategory || ''),
    acceptsInternationalBusiness: data.acceptInternationalBusiness ?? business.acceptInternationalBusiness ?? false,
    globalNetworkEnabled: data.globalNetworkEnabled || false,
    idealReferralTypes,
    productsAndServices: Array.isArray(business.productsAndServices) ? business.productsAndServices : [],
  };
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

  const dryRun = req.method === 'GET';

  try {
    // 1. Fetch all members and all existing listings in parallel
    const [membersSnap, listingsSnap] = await Promise.all([
      db.collection(MEMBERS_COL).get(),
      db.collection(LISTINGS_COL).get(),
    ]);

    const existingListingIds = new Set(listingsSnap.docs.map(d => d.id));

    // 2. Classify each member
    const toUpsert = [];   // { id, profile }
    const toDelete = [];   // doc refs for existing listings that should be removed
    let skipped = 0;

    for (const memberDoc of membersSnap.docs) {
      const data = memberDoc.data();
      const id = memberDoc.id;
      const shareCard = data.privacy?.shareCardInternationally;

      if (shareCard !== true) {
        if (existingListingIds.has(id)) toDelete.push(db.collection(LISTINGS_COL).doc(id));
        else skipped++;
        continue;
      }

      const profile = mapMember(id, data);
      if (!profile) {
        // has shareCard=true but no companyName → delete stale listing if any
        if (existingListingIds.has(id)) toDelete.push(db.collection(LISTINGS_COL).doc(id));
        else skipped++;
        continue;
      }

      toUpsert.push({ id, profile });
    }

    if (dryRun) {
      return Response.json({
        dryRun: true,
        totalMembers: membersSnap.size,
        wouldUpsert: toUpsert.length,
        wouldDelete: toDelete.length,
        wouldSkip: skipped,
      }, { status: 200, headers: cors });
    }

    // 3. Execute in batches of 500 (Firestore Admin limit)
    const now = Timestamp.now();
    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += 500) {
      const batch = db.batch();
      toUpsert.slice(i, i + 500).forEach(({ id, profile }) => {
        batch.set(db.collection(LISTINGS_COL).doc(id), { ...profile, memberId: id, updatedAt: now }, { merge: true });
      });
      await batch.commit();
      upserted += Math.min(500, toUpsert.length - i);
    }

    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = db.batch();
      toDelete.slice(i, i + 500).forEach(ref => batch.delete(ref));
      await batch.commit();
      deleted += Math.min(500, toDelete.length - i);
    }

    console.log(`[backfill-public-listings] by=${callerUid} upserted=${upserted} deleted=${deleted} skipped=${skipped}`);
    return Response.json({
      dryRun: false,
      upserted,
      deleted,
      skipped,
    }, { status: 200, headers: cors });

  } catch (err) {
    console.error('[backfill-public-listings] error:', err.message);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
};
