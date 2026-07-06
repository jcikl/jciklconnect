"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onEventRegistrationUpdate = exports.onSubmissionApproved = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Make sure the admin SDK is initialized before using these functions.
const db = admin.firestore();
/**
 * Trigger to automatically recalculate and update a given LO's lo_star_progress
 * document when a new submission is approved.
 */
exports.onSubmissionApproved = functions.firestore
    .document('incentiveSubmissions/{submissionId}')
    .onUpdate(async (change, context) => {
    var _a, _b;
    const before = change.before.data();
    const after = change.after.data();
    // Only proceed if status changed from something else to APPROVED
    if (before.status === 'APPROVED' || after.status !== 'APPROVED') {
        return null;
    }
    const standardId = after.standardId;
    const loId = after.loId;
    const scoreAwarded = after.scoreAwarded || 0;
    if (!loId || scoreAwarded === 0) {
        return null;
    }
    // 1. Fetch the standard to know its category (efficient, network, etc.)
    const standardDoc = await db.collection('incentiveStandards').doc(standardId).get();
    if (!standardDoc.exists) {
        console.error(`Standard ${standardId} not found`);
        return null;
    }
    const standard = standardDoc.data();
    const category = standard === null || standard === void 0 ? void 0 : standard.category;
    const programId = standard === null || standard === void 0 ? void 0 : standard.programId;
    if (!category || !programId) {
        console.error('Standard is missing category or programId');
        return null;
    }
    // 2. Fetch the program to know the threshold
    const programDoc = await db.collection('incentivePrograms').doc(programId).get();
    if (!programDoc.exists) {
        console.error(`Program ${programId} not found`);
        return null;
    }
    const program = programDoc.data();
    const minScore = ((_b = (_a = program === null || program === void 0 ? void 0 : program.categories) === null || _a === void 0 ? void 0 : _a[category]) === null || _b === void 0 ? void 0 : _b.minScore) || 250;
    const year = (program === null || program === void 0 ? void 0 : program.year) || new Date().getFullYear();
    // 3. Update the LOStarProgress document
    // Using a transaction to ensure atomic updates
    const progressRef = db.collection('loStarProgress').doc(`${loId}_${year}`);
    try {
        await db.runTransaction(async (t) => {
            const doc = await t.get(progressRef);
            let data = doc.exists ? doc.data() : {
                loId,
                year,
                categories: {},
                details: {},
                totalPoints: 0,
                starsUnlocked: 0,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };
            if (data) {
                if (!data.categories[category]) {
                    data.categories[category] = { current: 0, total: minScore, stars: 0 };
                }
                const currentPoints = data.categories[category].current + scoreAwarded;
                let stars = 0;
                if (currentPoints >= minScore) {
                    stars = 1;
                    // Optional: trigger system alert if a new star is officially unlocked
                    if (data.categories[category].stars === 0) {
                        console.log(`LO ${loId} has unlocked the ${category} star!`);
                    }
                }
                data.categories[category].current = currentPoints;
                data.categories[category].stars = stars;
                data.totalPoints = (data.totalPoints || 0) + scoreAwarded;
                let totalStars = 0;
                Object.values(data.categories).forEach((cat) => {
                    totalStars += cat.stars || 0;
                });
                data.starsUnlocked = totalStars;
                data.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
                t.set(progressRef, data, { merge: true });
            }
        });
        console.log(`Successfully updated LO Star Progress for ${loId} - added ${scoreAwarded} points to ${category}`);
        return null;
    }
    catch (error) {
        console.error('Transaction failure in onSubmissionApproved:', error);
        throw error;
    }
});
/**
 * Automate generating event attendance points submissions.
 */
exports.onEventRegistrationUpdate = functions.firestore
    .document('eventRegistrations/{regId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === 'checked_in' || after.status !== 'checked_in') {
        return null; // Only care about new check-ins
    }
    const { memberId, eventId, loId } = after;
    if (!memberId || !loId)
        return null;
    // A real implementation would query `incentiveStandards` for the right standardId 
    // linked to event attendance, perhaps `2026_NETWORK_01` (Attending an Event).
    // Let's assume a hardcoded generic ID or find one with "verificationType: 'AUTO_SYSTEM'".
    try {
        await db.collection('incentiveSubmissions').add({
            loId: loId,
            memberId: memberId,
            standardId: 'AUTO_EVENT_ATTENDANCE', // This should be queried
            quantity: 1,
            status: 'APPROVED',
            scoreAwarded: 10,
            evidenceText: `System auto-verified: Event check-in for ${eventId}`,
            evidenceFiles: [],
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedBy: 'SYSTEM'
        });
        console.log(`Auto assigned points to Member ${memberId} of LO ${loId} for checking in to ${eventId}`);
        return null;
    }
    catch (err) {
        console.error('Error auto assigning points on check-in', err);
        return null;
    }
});
//# sourceMappingURL=gamificationLogic.js.map