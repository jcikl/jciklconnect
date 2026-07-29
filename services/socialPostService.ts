import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, orderBy, getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import type { SocialPost, SocialPostCreateInput, SocialPostStatus } from '../types/socialPost';

const COL = COLLECTIONS.SOCIAL_POSTS;

const MOCK_POSTS: SocialPost[] = [
  {
    id: 'mock-1',
    title: 'JCI KL Business Development Mixer',
    rawContent: 'Join us for an exciting business networking event this Friday! Connect with like-minded professionals and grow your network.',
    editedContent: '🤝 Expand your circle at the JCI KL Business Development Mixer this Friday! An evening of meaningful connections, opportunities, and growth awaits. Seats are limited — register now! #JCIKL #BusinessDevelopment #Networking',
    platforms: ['facebook'],
    status: 'pending_review',
    submittedBy: 'mock-member-1',
    submittedByName: 'Alice Tan',
    aiGenerated: true,
    hashtags: ['JCIKL', 'BusinessDevelopment', 'Networking'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mock-2',
    title: 'Community Clean-Up Drive',
    rawContent: 'We are organizing a community clean-up drive at Taman Jaya this Saturday morning from 8am to 12pm.',
    platforms: ['facebook'],
    status: 'draft',
    submittedBy: 'mock-member-2',
    submittedByName: 'Ben Lim',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mock-3',
    title: 'JCI KL Annual Gala Night',
    rawContent: 'Celebrating another year of excellence and impact. Join us for the JCI KL Annual Gala Night.',
    editedContent: '✨ A night to remember! The JCI KL Annual Gala Night celebrates a year of impact, leadership, and community. Dress to impress and celebrate with us! 🎉 #JCIGala #Leadership #Community',
    platforms: ['facebook'],
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    submittedBy: 'mock-member-1',
    submittedByName: 'Alice Tan',
    reviewedBy: 'mock-bod-1',
    aiGenerated: true,
    hashtags: ['JCIGala', 'Leadership', 'Community'],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export class SocialPostService {
  static async createPost(input: SocialPostCreateInput, member: { id: string; name: string }): Promise<SocialPost> {
    if (isDevMode()) {
      return {
        id: `mock-${Date.now()}`,
        ...input,
        status: 'draft',
        submittedBy: member.id,
        submittedByName: member.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const data = {
      ...input,
      status: 'draft' as SocialPostStatus,
      submittedBy: member.id,
      submittedByName: member.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, COL), data);
    return { id: ref.id, ...data };
  }

  static async updatePost(id: string, updates: Partial<SocialPost>): Promise<void> {
    if (isDevMode()) return;
    await updateDoc(doc(db, COL, id), { ...updates, updatedAt: new Date().toISOString() });
  }

  static async submitForReview(id: string): Promise<void> {
    if (isDevMode()) return;
    await updateDoc(doc(db, COL, id), { status: 'pending_review', updatedAt: new Date().toISOString() });
  }

  static async approvePost(id: string, reviewerId: string, editedContent?: string): Promise<void> {
    if (isDevMode()) return;
    await updateDoc(doc(db, COL, id), {
      status: 'approved',
      reviewedBy: reviewerId,
      ...(editedContent !== undefined && { editedContent }),
      updatedAt: new Date().toISOString(),
    });
  }

  static async rejectPost(id: string, reviewerId: string, reason: string): Promise<void> {
    if (isDevMode()) return;
    await updateDoc(doc(db, COL, id), {
      status: 'rejected',
      reviewedBy: reviewerId,
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    });
  }

  static async schedulePost(id: string, scheduledAt: string): Promise<void> {
    if (isDevMode()) return;
    await updateDoc(doc(db, COL, id), { status: 'scheduled', scheduledAt, updatedAt: new Date().toISOString() });
  }

  static async markPublished(id: string): Promise<void> {
    if (isDevMode()) return;
    await updateDoc(doc(db, COL, id), {
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static async getMyPosts(memberId: string): Promise<SocialPost[]> {
    if (isDevMode()) return MOCK_POSTS.filter(p => p.submittedBy === 'mock-member-1');
    const q = query(collection(db, COL), where('submittedBy', '==', memberId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
  }

  static async getAllPosts(): Promise<SocialPost[]> {
    if (isDevMode()) return MOCK_POSTS;
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
  }

  static async getPostsByStatus(status: SocialPostStatus): Promise<SocialPost[]> {
    if (isDevMode()) return MOCK_POSTS.filter(p => p.status === status);
    const q = query(collection(db, COL), where('status', '==', status), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
  }

  static async deletePost(id: string): Promise<void> {
    if (isDevMode()) return;
    await deleteDoc(doc(db, COL, id));
  }

  static async aiRewrite(content: string, platform: string, tone: string): Promise<string> {
    if (isDevMode()) {
      return `✨ [AI Rewritten for ${platform}]\n\n${content}\n\n#JCIKL #Leadership #Community`;
    }
    const res = await fetch('/.netlify/functions/social-ai-rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, platform, tone }),
    });
    if (!res.ok) throw new Error('AI rewrite failed');
    const data = await res.json();
    return data.rewritten;
  }
}
