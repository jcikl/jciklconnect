import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface PermissionCatalogItem {
  id: string;
  key: string;
  name: string;
  category: string;
  description?: string;
  active: boolean;
  updatedAt?: unknown;
}

export interface PermissionRule {
  id: string;
  permissionKey: string;
  allowed: boolean;
  active: boolean;
  priority: number;
  userRole?: string;
  membershipType?: string;
  position?: string;
  scope?: string;
  updatedAt?: unknown;
}

export interface PermissionConfigSnapshot {
  catalog: PermissionCatalogItem[];
  userRoleRules: PermissionRule[];
  membershipTypeRules: PermissionRule[];
  positionRules: PermissionRule[];
}

export type PermissionRuleCollection =
  | 'userRolePermissions'
  | 'membershipTypePermissions'
  | 'positionPermissions';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sortBy<T>(items: T[], picker: (item: T) => string | number): T[] {
  return [...items].sort((a, b) => {
    const av = picker(a);
    const bv = picker(b);
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function permissionRuleId(principal: string, permissionKey: string): string {
  return `${principal}_${permissionKey}`
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function readCatalog(): Promise<PermissionCatalogItem[]> {
  const snap = await getDocs(collection(db, 'permissionCatalog'));
  const items = snap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      key: asString(data.key, entry.id),
      name: asString(data.name, entry.id),
      category: asString(data.category, 'General'),
      description: asString(data.description),
      active: asBoolean(data.active, true),
      updatedAt: data.updatedAt,
    };
  });
  return sortBy(items, (item) => `${item.category}:${item.name}`);
}

async function readRules(collectionName: PermissionRuleCollection): Promise<PermissionRule[]> {
  const snap = await getDocs(collection(db, collectionName));
  const items = snap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      permissionKey: asString(data.permissionKey),
      allowed: asBoolean(data.allowed, true),
      active: asBoolean(data.active, true),
      priority: asNumber(data.priority, 0),
      userRole: asString(data.userRole),
      membershipType: asString(data.membershipType),
      position: asString(data.position),
      scope: asString(data.scope),
      updatedAt: data.updatedAt,
    };
  });
  return sortBy(items, (item) => `${item.userRole || item.membershipType || item.position}:${item.permissionKey}`);
}

export const PermissionConfigService = {
  async getSnapshot(): Promise<PermissionConfigSnapshot> {
    const [catalog, userRoleRules, membershipTypeRules, positionRules] = await Promise.all([
      readCatalog(),
      readRules('userRolePermissions'),
      readRules('membershipTypePermissions'),
      readRules('positionPermissions'),
    ]);

    return { catalog, userRoleRules, membershipTypeRules, positionRules };
  },

  async saveRule(collectionName: PermissionRuleCollection, rule: PermissionRule): Promise<void> {
    const principal =
      rule.userRole ||
      rule.membershipType ||
      rule.position ||
      'unknown';
    const id = rule.id || permissionRuleId(principal, rule.permissionKey);
    const { id: _id, updatedAt: _updatedAt, ...payload } = rule;
    await setDoc(
      doc(db, collectionName, id),
      {
        ...payload,
        updatedAt: new Date(),
      },
      { merge: true },
    );
  },

  async saveCatalogItem(item: PermissionCatalogItem): Promise<void> {
    const id = item.id || item.key;
    await setDoc(
      doc(db, 'permissionCatalog', id),
      {
        key: item.key,
        name: item.name,
        category: item.category,
        description: item.description || '',
        active: item.active,
        updatedAt: new Date(),
      },
      { merge: true },
    );
  },
};

