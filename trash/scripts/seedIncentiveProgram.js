import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc } from 'firebase/firestore';

// Replace with your actual Firebase config or use Admin SDK in a Node.js env
const firebaseConfig = {
    // Config goes here
};

// This is a browser-compatible script outline for seeding. 
// Run this carefully in a controlled environment or migrate to Firebase Functions/Admin script.

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedData = async () => {
    try {
        console.log('Seeding 2026_MY Incentive Program...');

        // 1. Create Program
        await setDoc(doc(db, 'incentivePrograms', '2026_MY'), {
            id: '2026_MY',
            year: 2026,
            name: '2026 JCI Malaysia Incentive Program',
            isActive: true,
            categories: {
                efficient: { label: 'Efficient Star', minScore: 100, isFundamental: true },
                network: { label: 'Network Star', minScore: 250 },
                experience: { label: 'Experience Star', minScore: 250 },
                outreach: { label: 'Outreach Star', minScore: 250 },
                impact: { label: 'Impact Star', minScore: 250 }
            },
            specialAwards: [
                { name: 'Best of the Best', criteria: ['5 Stars', 'Growth > 10%', 'Good Financial'] }
            ]
        });

        console.log('Program seeded!');

        // 2. Create Standards
        const standards = [
            {
                id: '2026_EFFICIENT_01',
                programId: '2026_MY',
                category: 'efficient',
                order: 1,
                title: 'Update Local Officer\'s info',
                description: 'Update your Local Organization Officers info by the deadline.',
                targetType: 'LO',
                verificationType: 'MANUAL_UPLOAD',
                milestones: [
                    { id: 'ms1', label: 'Q1 Submission', points: 5, deadline: '2026-03-31' },
                    { id: 'ms2', label: 'Q2 Submission', points: 5, deadline: '2026-06-30' }
                ],
                evidenceRequirements: ['Screenshot of update']
            },
            {
                id: '2026_OUTREACH_01',
                programId: '2026_MY',
                category: 'outreach',
                order: 1,
                title: 'Local Organization E-Newsletter',
                description: 'Publish a meaningful E-Newsletter representing the LO.',
                targetType: 'LO',
                pointCap: 60,
                verificationType: 'MANUAL_UPLOAD',
                milestones: [
                    { id: 'ms1', label: 'Q1 Submission', points: 20, deadline: '2026-03-31' },
                    { id: 'ms2', label: 'Q3 Submission', points: 20, deadline: '2026-09-30' }
                ],
                evidenceRequirements: ['Link to post', 'PDF document']
            }
        ];

        for (const standard of standards) {
            // Create manually with a specific id
            await setDoc(doc(db, 'incentiveStandards', standard.id), standard);
        }

        console.log('Standards seeded! Seeding complete.');
    } catch (error) {
        console.error('Error seeding data:', error);
    }
};

// uncomment to run:
// seedData();
