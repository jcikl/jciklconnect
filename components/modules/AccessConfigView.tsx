import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { Badge, Button, Card, useToast } from '../ui/Common';
import { usePermissions } from '../../hooks/usePermissions';
import {
  PermissionCatalogItem,
  PermissionConfigService,
  PermissionRule,
  PermissionRuleCollection,
  permissionRuleId,
} from '../../services/permissionConfigService';

type PrincipalKind = 'role' | 'position';

interface PrincipalColumn {
  id: string;
  label: string;
  kind: PrincipalKind;
  collection: PermissionRuleCollection;
}

const ROLE_COLUMNS = ['Admin', 'Developer', 'Board', 'Member', 'Guest'];
const POSITION_COLUMNS = [
  'President',
  'Immediate Past President',
  'Executive Vice President',
  'Vice President',
  'Secretary',
  'Honorary Treasurer',
  'General Legal Council',
];

const GROUPS: { id: PrincipalKind; label: string; columns: PrincipalColumn[] }[] = [
  {
    id: 'role',
    label: 'User Roles',
    columns: ROLE_COLUMNS.map((label) => ({ id: `role:${label}`, label, kind: 'role', collection: 'userRolePermissions' })),
  },
  {
    id: 'position',
    label: 'Positions',
    columns: POSITION_COLUMNS.map((label) => ({ id: `position:${label}`, label, kind: 'position', collection: 'positionPermissions' })),
  },
];

const CATEGORY_ORDER = ['Members', 'Board', 'Events', 'Finance', 'Payments', 'Inventory', 'Reports', 'System', 'Data', 'General'];

const Toggle: React.FC<{ checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }> = ({
  checked,
  onChange,
  disabled,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-1 ${
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
    } ${checked ? 'bg-jci-blue' : 'bg-slate-200'}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

function categoryVariant(category: string): React.ComponentProps<typeof Badge>['variant'] {
  const value = category.toLowerCase();
  if (value.includes('finance') || value.includes('payment')) return 'gold';
  if (value.includes('system') || value.includes('data')) return 'warning';
  if (value.includes('members') || value.includes('board')) return 'jci';
  if (value.includes('events') || value.includes('reports')) return 'info';
  return 'neutral';
}

function normalizedCategory(permission: PermissionCatalogItem): string {
  return permission.category?.trim() || 'General';
}

function categorySortValue(category: string): number {
  const exact = CATEGORY_ORDER.findIndex((item) => item.toLowerCase() === category.toLowerCase());
  if (exact >= 0) return exact;
  const fuzzy = CATEGORY_ORDER.findIndex((item) => category.toLowerCase().includes(item.toLowerCase()));
  return fuzzy >= 0 ? fuzzy : CATEGORY_ORDER.length;
}

function rulePrincipal(rule: PermissionRule, kind: PrincipalKind): string {
  if (kind === 'role') return rule.userRole || '';
  return rule.position || '';
}

function makeRule(column: PrincipalColumn, permission: PermissionCatalogItem, existing?: PermissionRule): PermissionRule {
  const principal = column.label;
  const base: PermissionRule = {
    id: existing?.id || permissionRuleId(principal, permission.key),
    permissionKey: permission.key,
    allowed: existing?.allowed ?? false,
    active: existing?.active ?? true,
    priority: existing?.priority ?? (column.kind === 'position' ? 80 : 100),
    scope: existing?.scope || (column.kind === 'position' ? 'Board' : ''),
  };

  if (column.kind === 'role') return { ...base, userRole: principal };
  return { ...base, position: principal };
}

function buildRuleMap(rules: PermissionRule[], kind: PrincipalKind): Map<string, PermissionRule> {
  const map = new Map<string, PermissionRule>();
  rules.forEach((rule) => {
    const principal = rulePrincipal(rule, kind);
    if (!principal || !rule.permissionKey) return;
    map.set(`${principal}::${rule.permissionKey}`, rule);
  });
  return map;
}

function groupPermissions(items: PermissionCatalogItem[]): { category: string; items: PermissionCatalogItem[] }[] {
  const map = new Map<string, PermissionCatalogItem[]>();
  items.forEach((permission) => {
    const category = normalizedCategory(permission);
    const group = map.get(category) || [];
    group.push(permission);
    map.set(category, group);
  });

  return [...map.entries()]
    .map(([category, groupItems]) => ({
      category,
      items: groupItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    }))
    .sort((a, b) => {
      const av = categorySortValue(a.category);
      const bv = categorySortValue(b.category);
      if (av !== bv) return av - bv;
      return a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
    });
}

const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{body}</p>
  </div>
);

export const AccessConfigView: React.FC = () => {
  const { isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<PrincipalKind>('role');
  const [showInactive, setShowInactive] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [roleRules, setRoleRules] = useState<PermissionRule[]>([]);
  const [positionRules, setPositionRules] = useState<PermissionRule[]>([]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const snapshot = await PermissionConfigService.getSnapshot();
      setCatalog(snapshot.catalog);
      setRoleRules(snapshot.userRoleRules);
      setPositionRules(snapshot.positionRules);
    } catch (error) {
      console.error('[AccessConfigView] Failed to load permission config:', error);
      showToast('Failed to load permission configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const rulesByKind = useMemo(
    () => ({
      role: buildRuleMap(roleRules, 'role'),
      position: buildRuleMap(positionRules, 'position'),
    }),
    [positionRules, roleRules],
  );

  const activeColumns = useMemo(
    () => GROUPS.find((group) => group.id === activeGroup)?.columns || GROUPS[0].columns,
    [activeGroup],
  );

  const filteredCatalog = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog
      .filter((permission) => showInactive || permission.active)
      .filter((permission) => {
        if (!needle) return true;
        return [permission.key, permission.name, permission.category, permission.description || '']
          .join(' ')
          .toLowerCase()
          .includes(needle);
      });
  }, [catalog, query, showInactive]);

  const permissionGroups = useMemo(() => groupPermissions(filteredCatalog), [filteredCatalog]);
  const activePermissionCount = catalog.filter((permission) => permission.active).length;
  const enabledRuleCount = [...roleRules, ...positionRules].filter((rule) => rule.active && rule.allowed).length;

  const updateLocalRule = (column: PrincipalColumn, saved: PermissionRule) => {
    const updater = (items: PermissionRule[]) => {
      const next = items.filter((item) => item.id !== saved.id);
      return [...next, saved].sort((a, b) =>
        `${rulePrincipal(a, column.kind)}:${a.permissionKey}`.localeCompare(`${rulePrincipal(b, column.kind)}:${b.permissionKey}`),
      );
    };

    if (column.kind === 'role') setRoleRules(updater);
    if (column.kind === 'position') setPositionRules(updater);
  };

  const saveRule = async (column: PrincipalColumn, permission: PermissionCatalogItem, allowed: boolean) => {
    if (!isAdmin) {
      showToast('Admin permission required', 'error');
      return;
    }

    const existing = rulesByKind[column.kind].get(`${column.label}::${permission.key}`);
    const next = makeRule(column, permission, existing);
    next.allowed = allowed;
    next.active = true;

    setSavingKey(`${column.id}:${permission.key}`);
    try {
      await PermissionConfigService.saveRule(column.collection, next);
      updateLocalRule(column, next);
      showToast('Permission updated', 'success');
    } catch (error) {
      console.error('[AccessConfigView] Failed to save permission rule:', error);
      showToast('Failed to update permission', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <Card>
        <div className="py-8 text-center">
          <ShieldCheck className="mx-auto mb-3 text-slate-400" size={28} />
          <p className="text-sm font-semibold text-slate-700">Admin permission required</p>
          <p className="mt-1 text-sm text-slate-500">Only administrators can manage access configuration.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="rounded-lg" noPadding>
          <div className="p-4">
            <p className="text-xs font-medium text-slate-500">Active Permissions</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{activePermissionCount}</p>
          </div>
        </Card>
        <Card className="rounded-lg" noPadding>
          <div className="p-4">
            <p className="text-xs font-medium text-slate-500">Enabled Rules</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{enabledRuleCount}</p>
          </div>
        </Card>
        <Card className="rounded-lg" noPadding>
          <div className="p-4">
            <p className="text-xs font-medium text-slate-500">Feature Groups</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{permissionGroups.length}</p>
          </div>
        </Card>
      </div>

      <Card
        title="Access"
        description="Permissions grouped by feature, managed by user role and board position."
        action={
          <Button type="button" variant="outline" size="sm" onClick={loadConfig} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        }
        noPadding
      >
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroup(group.id)}
                  className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition-colors ${
                    activeGroup === group.id
                      ? 'bg-jci-blue text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search permissions"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/15"
                />
              </label>
              <label className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                />
                Show inactive
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {loading ? (
            <EmptyState title="Loading access configuration" body="Reading permission collections from Firebase." />
          ) : catalog.length === 0 ? (
            <EmptyState title="No permission catalog" body="Run npm run firebase:permissions:seed before editing access rules." />
          ) : permissionGroups.length === 0 ? (
            <EmptyState title="No permissions found" body="Try another search term or enable inactive permissions." />
          ) : (
            permissionGroups.map((group) => {
              const collapsed = collapsedCategories.has(group.category);
              const enabledInGroup = group.items.reduce((count, permission) => {
                return count + activeColumns.filter((column) => {
                  const rule = rulesByKind[column.kind].get(`${column.label}::${permission.key}`);
                  return rule?.active && rule?.allowed;
                }).length;
              }, 0);

              return (
                <div key={group.category} className="overflow-hidden rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category)}
                    className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-slate-500 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{group.category}</p>
                          <Badge variant={categoryVariant(group.category)}>{group.items.length} permissions</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{enabledInGroup} enabled rules in this view</p>
                      </div>
                    </div>
                  </button>

                  {!collapsed && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-y border-slate-200 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="sticky left-0 z-10 min-w-[280px] bg-white px-4 py-3">Permission</th>
                            {activeColumns.map((column) => (
                              <th key={column.id} className="min-w-[116px] px-3 py-3 text-center normal-case tracking-normal">
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {group.items.map((permission) => (
                            <tr key={permission.id} className={!permission.active ? 'bg-slate-50/70 opacity-70' : ''}>
                              <td className="sticky left-0 z-10 max-w-[340px] bg-inherit px-4 py-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {permission.active ? (
                                      <Check size={14} className="text-green-600" />
                                    ) : (
                                      <X size={14} className="text-slate-300" />
                                    )}
                                    <p className="truncate font-semibold text-slate-900">{permission.name}</p>
                                  </div>
                                  {permission.description && (
                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{permission.description}</p>
                                  )}
                                </div>
                              </td>
                              {activeColumns.map((column) => {
                                const rule = rulesByKind[column.kind].get(`${column.label}::${permission.key}`);
                                const checked = Boolean(rule?.active && rule?.allowed);
                                const busy = savingKey === `${column.id}:${permission.key}`;
                                return (
                                  <td key={column.id} className="px-3 py-3 text-center">
                                    <div className="flex justify-center">
                                      <Toggle
                                        checked={checked}
                                        disabled={busy || !permission.active}
                                        label={`${column.label} ${permission.name}`}
                                        onChange={(value) => saveRule(column, permission, value)}
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
