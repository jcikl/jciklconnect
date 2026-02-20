"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.membershipFunctions = exports.generateDuesRenewal = exports.checkMemberPromotion = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
// Function to handle member promotion from Probation to Full
exports.checkMemberPromotion = functions.firestore
    .document('members/{memberId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const memberId = context.params.memberId;
    // Only check Probation members
    if (after.membershipType !== 'probation') {
        return null;
    }
    // Check if promotion progress was updated
    if (!after.promotionProgress ||
        JSON.stringify(before.promotionProgress) === JSON.stringify(after.promotionProgress)) {
        return null;
    }
    const progress = after.promotionProgress;
    // Check if all requirements are met
    const allRequirementsMet = progress.bodMeetingAttended &&
        progress.eventOrganizerParticipation &&
        progress.eventParticipation &&
        progress.jciInspireCompleted;
    if (allRequirementsMet && !progress.promotedToFull) {
        // Promote to Full Member
        await db.collection('members').doc(memberId).update({
            membershipType: 'full',
            'promotionProgress.promotedToFull': true,
            'promotionProgress.completedDate': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Create notification
        await db.collection('notifications').add({
            memberId: memberId,
            type: 'promotion',
            title: 'Congratulations! You have been promoted to Full Member',
            message: 'You have successfully completed all requirements and have been promoted from Probation Member to Full Member. Your dues for next renewal will be RM300.',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Member ${memberId} promoted from Probation to Full Member`);
    }
    return null;
});
// Function to handle annual dues renewal
exports.generateDuesRenewal = functions.https.onCall(async (data, context) => {
    var _a;
    // Verify admin permissions
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userDoc = await db.collection('members').doc(context.auth.uid).get();
    if (!userDoc.exists || !['BOARD', 'ADMIN'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
    }
    const { duesYear } = data;
    if (!duesYear || typeof duesYear !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid dues year is required');
    }
    const previousYear = duesYear - 1;
    // Get members who paid dues in previous year
    const previousYearDues = await db.collection('duesTransactions')
        .where('duesYear', '==', previousYear)
        .where('status', '==', 'paid')
        .get();
    const renewalMemberIds = new Set(previousYearDues.docs.map(doc => doc.data().memberId));
    // Get all current members
    const membersSnapshot = await db.collection('members').get();
    const batch = db.batch();
    let renewalCount = 0;
    for (const memberDoc of membersSnapshot.docs) {
        const member = memberDoc.data();
        const memberId = memberDoc.id;
        // Skip if already has dues transaction for this year
        const existingDues = await db.collection('duesTransactions')
            .where('memberId', '==', memberId)
            .where('duesYear', '==', duesYear)
            .get();
        if (!existingDues.empty) {
            continue;
        }
        // Determine dues amount based on membership type
        let amount = 0;
        switch (member.membershipType) {
            case 'probation':
                amount = 350;
                break;
            case 'full':
                amount = 300;
                break;
            case 'honorary':
                // Verify age requirement
                if (member.age <= 40) {
                    console.warn(`Honorary member ${memberId} is not over 40 years old`);
                    continue;
                }
                amount = 50;
                break;
            case 'senator':
                // Verify senator certification
                if (!member.senatorCertified) {
                    console.warn(`Senator ${memberId} does not have valid certification`);
                    continue;
                }
                amount = 0;
                break;
            case 'visiting':
                // Verify non-Malaysian citizenship
                if (member.citizenship === 'Malaysian') {
                    console.warn(`Visiting member ${memberId} has Malaysian citizenship`);
                    continue;
                }
                amount = 500;
                break;
            default:
                console.warn(`Unknown membership type for member ${memberId}: ${member.membershipType}`);
                continue;
        }
        // Create dues transaction
        const duesTransactionRef = db.collection('duesTransactions').doc();
        batch.set(duesTransactionRef, {
            memberId: memberId,
            membershipType: member.membershipType,
            duesYear: duesYear,
            amount: amount,
            status: amount === 0 ? 'paid' : 'pending', // Senators are automatically paid
            isRenewal: renewalMemberIds.has(memberId),
            dueDate: new Date(duesYear, 2, 31), // March 31st
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        renewalCount++;
    }
    await batch.commit();
    return {
        success: true,
        renewalCount: renewalCount,
        duesYear: duesYear
    };
});
exports.membershipFunctions = {
    checkMemberPromotion: exports.checkMemberPromotion,
    generateDuesRenewal: exports.generateDuesRenewal
};
//# sourceMappingURL=membership.js.map