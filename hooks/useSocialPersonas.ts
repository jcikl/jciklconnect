import { useState, useEffect, useCallback } from 'react';
import { SocialPersonaService } from '../services/socialPersonaService';
import { DEFAULT_PERSONAS } from '../types/socialPersona';
import type { SocialPersona } from '../types/socialPersona';
import type { SocialPostPlatform } from '../types/socialPost';

const PLATFORMS: SocialPostPlatform[] = ['facebook', 'instagram', 'linkedin', 'xiaohongshu'];

function buildDefaults(): SocialPersona[] {
  return PLATFORMS.map(platform => ({
    ...DEFAULT_PERSONAS[platform],
    id: platform,
    updatedAt: new Date().toISOString(),
  }));
}

export function useSocialPersonas() {
  const [personas, setPersonas] = useState<SocialPersona[]>(buildDefaults());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPersonas(await SocialPersonaService.getAllPersonas());
    } catch {
      // Firestore rules may not be deployed yet — silently fall back to defaults.
      // Personas are still functional; BOD can configure once rules are deployed.
      setPersonas(buildDefaults());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upsert = async (platform: SocialPostPlatform, updates: Partial<SocialPersona>, updatedBy: string) => {
    await SocialPersonaService.upsertPersona(platform, updates, updatedBy);
    setPersonas(prev => prev.map(p => p.platform === platform ? { ...p, ...updates } : p));
  };

  const getPersona = (platform: SocialPostPlatform) =>
    personas.find(p => p.platform === platform);

  return { personas, loading, upsert, getPersona, reload: load };
}
