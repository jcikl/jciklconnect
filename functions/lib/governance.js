"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.governanceFunctions = exports.calculateElectionResults = exports.castElectionBallot = exports.calculateVoteResults = exports.castVote = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
// Function to validate vote casting
exports.castVote = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { voteId, optionId } = data;
    const voterId = context.auth.uid;
    if (!voteId || !optionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Vote ID and option ID are required');
    }
    // Get vote document
    const voteDoc = await db.collection('votes').doc(voteId).get();
    if (!voteDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Vote not found');
    }
    const vote = voteDoc.data();
    if (!vote) {
        throw new functions.https.HttpsError('not-found', 'Vote data not found');
    }
    // Check if vote is active
    const now = new Date();
    const startDate = vote.startDate.toDate();
    const endDate = vote.endDate.toDate();
    if (now < startDate || now > endDate) {
        throw new functions.https.HttpsError('failed-precondition', 'Vote is not currently active');
    }
    // Check if user is eligible to vote
    if (!vote.eligibleVoters.includes(voterId)) {
        throw new functions.https.HttpsError('permission-denied', 'User is not eligible to vote');
    }
    // Check if user has already voted
    const existingVote = await db.collection('voteCasts')
        .where('voteId', '==', voteId)
        .where('voterId', '==', voterId)
        .get();
    if (!existingVote.empty) {
        throw new functions.https.HttpsError('already-exists', 'User has already voted');
    }
    // Validate option exists
    const validOption = vote.options.find((option) => option.id === optionId);
    if (!validOption) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid vote option');
    }
    // Cast the vote
    await db.collection('voteCasts').add({
        voteId: voteId,
        voterId: voterId,
        optionId: optionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    // Update vote counts
    const updatedOptions = vote.options.map((option) => {
        if (option.id === optionId) {
            return Object.assign(Object.assign({}, option), { voteCount: (option.voteCount || 0) + 1 });
        }
        return option;
    });
    await db.collection('votes').doc(voteId).update({
        options: updatedOptions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        voteId: voteId,
        optionId: optionId
    };
});
// Function to calculate vote results
exports.calculateVoteResults = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Verify admin permissions
    const userDoc = await db.collection('members').doc(context.auth.uid).get();
    if (!userDoc.exists || !['BOARD', 'ADMIN'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
    }
    const { voteId } = data;
    if (!voteId) {
        throw new functions.https.HttpsError('invalid-argument', 'Vote ID is required');
    }
    // Get vote document
    const voteDoc = await db.collection('votes').doc(voteId).get();
    if (!voteDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Vote not found');
    }
    const vote = voteDoc.data();
    if (!vote) {
        throw new functions.https.HttpsError('not-found', 'Vote data not found');
    }
    // Get all vote casts
    const voteCastsSnapshot = await db.collection('voteCasts')
        .where('voteId', '==', voteId)
        .get();
    const totalVotes = voteCastsSnapshot.size;
    const eligibleVoters = vote.eligibleVoters.length;
    const participationRate = eligibleVoters > 0 ? (totalVotes / eligibleVoters) * 100 : 0;
    // Calculate results for each option
    const results = vote.options.map((option) => {
        const optionVotes = voteCastsSnapshot.docs.filter(doc => doc.data().optionId === option.id).length;
        const percentage = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;
        return {
            id: option.id,
            text: option.text,
            voteCount: optionVotes,
            percentage: Math.round(percentage * 100) / 100
        };
    });
    // Sort by vote count (descending)
    results.sort((a, b) => b.voteCount - a.voteCount);
    const voteResults = {
        voteId: voteId,
        question: vote.question,
        totalVotes: totalVotes,
        eligibleVoters: eligibleVoters,
        participationRate: Math.round(participationRate * 100) / 100,
        results: results,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // Update vote document with results
    await db.collection('votes').doc(voteId).update({
        results: voteResults,
        status: 'closed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return voteResults;
});
// Function to cast election ballot
exports.castElectionBallot = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { electionId, votes } = data;
    const voterId = context.auth.uid;
    if (!electionId || !votes) {
        throw new functions.https.HttpsError('invalid-argument', 'Election ID and votes are required');
    }
    // Get election document
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Election not found');
    }
    const election = electionDoc.data();
    if (!election) {
        throw new functions.https.HttpsError('not-found', 'Election data not found');
    }
    // Check if election is in voting phase
    if (election.status !== 'voting') {
        throw new functions.https.HttpsError('failed-precondition', 'Election is not in voting phase');
    }
    const now = new Date();
    const votingStart = election.votingStartDate.toDate();
    const votingEnd = election.votingEndDate.toDate();
    if (now < votingStart || now > votingEnd) {
        throw new functions.https.HttpsError('failed-precondition', 'Voting period is not active');
    }
    // Check if user has already voted
    const existingBallot = await db.collection('electionBallots')
        .where('electionId', '==', electionId)
        .where('voterId', '==', voterId)
        .get();
    if (!existingBallot.empty) {
        throw new functions.https.HttpsError('already-exists', 'User has already voted in this election');
    }
    // Validate votes
    for (const positionId of Object.keys(votes)) {
        const position = election.positions.find((p) => p.id === positionId);
        if (!position) {
            throw new functions.https.HttpsError('invalid-argument', `Invalid position: ${positionId}`);
        }
        const candidateIds = Array.isArray(votes[positionId]) ? votes[positionId] : [votes[positionId]];
        // Check vote count doesn't exceed seats
        if (candidateIds.length > position.seats) {
            throw new functions.https.HttpsError('invalid-argument', `Too many votes for position ${position.title}`);
        }
        // Validate all candidate IDs
        for (const candidateId of candidateIds) {
            const validCandidate = position.candidates.find((c) => c.id === candidateId);
            if (!validCandidate) {
                throw new functions.https.HttpsError('invalid-argument', `Invalid candidate: ${candidateId}`);
            }
        }
    }
    // Cast the ballot
    await db.collection('electionBallots').add({
        electionId: electionId,
        voterId: voterId,
        votes: votes,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        electionId: electionId
    };
});
// Function to calculate election results
exports.calculateElectionResults = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Verify admin permissions
    const userDoc = await db.collection('members').doc(context.auth.uid).get();
    if (!userDoc.exists || !['BOARD', 'ADMIN'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
    }
    const { electionId } = data;
    if (!electionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Election ID is required');
    }
    // Get election document
    const electionDoc = await db.collection('elections').doc(electionId).get();
    if (!electionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Election not found');
    }
    const election = electionDoc.data();
    if (!election) {
        throw new functions.https.HttpsError('not-found', 'Election data not found');
    }
    // Get all ballots
    const ballotsSnapshot = await db.collection('electionBallots')
        .where('electionId', '==', electionId)
        .get();
    const totalBallots = ballotsSnapshot.size;
    const results = {};
    // Calculate results for each position
    for (const position of election.positions) {
        const positionResults = calculatePositionResults(position, ballotsSnapshot.docs.map(doc => doc.data()), election.votingMethod);
        results[position.id] = {
            title: position.title,
            seats: position.seats,
            totalVotes: positionResults.totalVotes,
            candidates: positionResults.candidates,
            winners: positionResults.winners
        };
    }
    const electionResults = {
        electionId: electionId,
        name: election.name,
        votingMethod: election.votingMethod,
        totalBallots: totalBallots,
        results: results,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // Update election document with results
    await db.collection('elections').doc(electionId).update({
        results: electionResults,
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return electionResults;
});
// Helper function to calculate position results
function calculatePositionResults(position, ballots, votingMethod) {
    const candidateVotes = {};
    let totalVotes = 0;
    // Initialize vote counts
    for (const candidate of position.candidates) {
        candidateVotes[candidate.id] = 0;
    }
    // Count votes based on voting method
    for (const ballot of ballots) {
        const positionVotes = ballot.votes[position.id];
        if (!positionVotes)
            continue;
        const votes = Array.isArray(positionVotes) ? positionVotes : [positionVotes];
        for (const candidateId of votes) {
            if (candidateVotes.hasOwnProperty(candidateId)) {
                candidateVotes[candidateId]++;
                totalVotes++;
            }
        }
    }
    // Create candidate results
    const candidates = position.candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name || 'Unknown',
        voteCount: candidateVotes[candidate.id] || 0,
        percentage: totalVotes > 0 ? Math.round((candidateVotes[candidate.id] / totalVotes) * 10000) / 100 : 0
    }));
    // Sort by vote count (descending)
    candidates.sort((a, b) => b.voteCount - a.voteCount);
    // Determine winners based on voting method
    let winners = [];
    if (votingMethod === 'plurality') {
        // Take top N candidates where N = number of seats
        winners = candidates.slice(0, position.seats);
    }
    else if (votingMethod === 'ranked_choice') {
        // Simplified ranked choice - just take plurality for now
        // In a real implementation, this would implement full ranked choice voting
        winners = candidates.slice(0, position.seats);
    }
    else if (votingMethod === 'approval') {
        // Take top N candidates where N = number of seats
        winners = candidates.slice(0, position.seats);
    }
    return {
        totalVotes: totalVotes,
        candidates: candidates,
        winners: winners
    };
}
exports.governanceFunctions = {
    castVote: exports.castVote,
    calculateVoteResults: exports.calculateVoteResults,
    castElectionBallot: exports.castElectionBallot,
    calculateElectionResults: exports.calculateElectionResults
};
//# sourceMappingURL=governance.js.map