import {
  collection, doc, getDoc, getDocs, setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import type { SocialPersona } from '../types/socialPersona';
import { DEFAULT_PERSONAS } from '../types/socialPersona';
import type { SocialPostPlatform } from '../types/socialPost';

const COL = COLLECTIONS.SOCIAL_PERSONAS;

export class SocialPersonaService {
  static async getAllPersonas(): Promise<SocialPersona[]> {
    if (isDevMode()) {
      return Object.entries(DEFAULT_PERSONAS).map(([platform, p]) => ({
        ...p,
        id: platform,
        updatedAt: new Date().toISOString(),
      }));
    }
    const snap = await getDocs(collection(db, COL));
    const fromDb = snap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPersona));
    // Merge with defaults for any platform not yet configured
    const platforms: SocialPostPlatform[] = ['facebook', 'instagram', 'linkedin', 'xiaohongshu'];
    return platforms.map(platform => {
      const existing = fromDb.find(p => p.platform === platform);
      if (existing) return existing;
      return { ...DEFAULT_PERSONAS[platform], id: platform, updatedAt: new Date().toISOString() };
    });
  }

  static async getPersona(platform: SocialPostPlatform): Promise<SocialPersona> {
    if (isDevMode()) {
      return { ...DEFAULT_PERSONAS[platform], id: platform, updatedAt: new Date().toISOString() };
    }
    const snap = await getDoc(doc(db, COL, platform));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as SocialPersona;
    return { ...DEFAULT_PERSONAS[platform], id: platform, updatedAt: new Date().toISOString() };
  }

  static async upsertPersona(platform: SocialPostPlatform, updates: Partial<SocialPersona>, updatedBy: string): Promise<void> {
    if (isDevMode()) return;
    await setDoc(doc(db, COL, platform), {
      ...updates,
      platform,
      updatedAt: new Date().toISOString(),
      updatedBy,
    }, { merge: true });
  }
}
