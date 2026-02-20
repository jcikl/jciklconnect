import { ADMINISTRATIVE_PROJECT_IDS } from '../config/constants';

const STORAGE_KEY = 'jci_administrative_project_ids';

export function getAdministrativeProjectIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) ? parsed : [...ADMINISTRATIVE_PROJECT_IDS];
    }
  } catch {
    // ignore
  }
  return [...ADMINISTRATIVE_PROJECT_IDS];
}

export function addAdministrativeProjectId(name: string): void {
  const ids = getAdministrativeProjectIds();
  const trimmed = name.trim();
  if (trimmed && !ids.includes(trimmed)) {
    ids.push(trimmed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
}
