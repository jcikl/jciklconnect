import { useState, useEffect, useCallback } from 'react';
import { SocialPersonaService } from '../services/socialPersonaService';
import type { SocialPersona } from '../types/socialPersona';
import type { SocialPostPlatform } from '../types/socialPost';

export function useSocialPersonas() {
  const [personas, setPersonas] = useState<SocialPersona[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPersonas(await SocialPersonaService.getAllPersonas());
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
