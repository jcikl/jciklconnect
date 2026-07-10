import React, { useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { Button, useToast, Tabs } from '../ui/Common';
import { UserRole } from '../../types';

// Reuse same Toggle as MembershipConfigView
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-1 ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
    } ${checked ? 'bg-jci-blue' : 'bg-slate-200'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
  </button>
);

const PERMISSION_KEYS = [
  'canViewMembers', 'canEditMembers', 'canViewFinance', 'canEditFinance',
  'canManageProjects', 'canManageEvents', 'canManageInventory',
  'canManageAutomation', 'canViewReports', 'canManageSettings', 'canApproveClaims',
] as const;

type PermKey = typeof PERMISSION_KEYS[number];
type Perms = Record<PermKey, boolean>;

const ALL_ON: Perms = Object.fromEntries(PERMISSION_KEYS.map(k => [k, true])) as Perms;
const ALL_OFF: Perms = Object.fromEntries(PERMISSION_KEYS.map(k => [k, false])) as Perms;

const CONFIGURABLE_ROLES: UserRole[] = [UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE];

const ROLE_LABELS: Record<string, string> = {
  [UserRole.GUEST]: 'Guest',
  [UserRole.MEMBER]: 'Member',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.INACTIVE]: 'Inactive',
};

function formatPermLabel(key: string) {
  return key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim();
}

// Compact permission list shared by both tabs
const PermList: React.FC<{
  perms: Perms;
  onToggle: (k: PermKey) => void;
  disabled?: boolean;
}> = ({ perms, onToggle, disabled }) => (
  <div className="divide-y divide-slate-100">
    {PERMISSION_KEYS.map(key => (
      <div key={key} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
        <span className="text-sm text-slate-700">{formatPermLabel(key)}</span>
        <Toggle checked={perms[key]} onChange={() => onToggle(key)} disabled={disabled} />
      </div>
    ))}
  </div>
);

export const AccessConfigView: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [boardPerms, setBoardPerms] = useState<Perms>({ ...ALL_ON });
  const [activeTab, setActiveTab] = useState<'dynamic' | 'roles'>('dynamic');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);

  const [rolePerms, setRolePerms] = useState<Record<string, Perms>>({
    [UserRole.GUEST]:       { ...ALL_OFF },
    [UserRole.MEMBER]:      { ...ALL_OFF, canViewMembers: true, canManageEvents: true },
    [UserRole.ADMIN]:       { ...ALL_ON },
    [UserRole.SUPER_ADMIN]: { ...ALL_ON },
    [UserRole.INACTIVE]:    { ...ALL_OFF },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      showToast('Access permissions updated successfully', 'success');
    } catch (e) {
      showToast('Failed to update access permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = selectedRole === UserRole.SUPER_ADMIN;

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Configure board and role-based access permissions.</p>
        <Button onClick={handleSave} disabled={saving} size="sm" className="flex items-center gap-1.5 shrink-0">
          <Save size={12} />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Inner tabs — short labels to fit mobile */}
      <Tabs
        tabs={[
          { id: 'dynamic', label: 'Board' },
          { id: 'roles',   label: 'Roles' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'dynamic' | 'roles')}
      />

      {/* ── Board tab ── */}
      {activeTab === 'dynamic' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Current Board Members</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Board position holders automatically receive these permissions regardless of base role.
            </p>
          </div>
          <PermList
            perms={boardPerms}
            onToggle={(k) => setBoardPerms(prev => ({ ...prev, [k]: !prev[k] }))}
          />
        </div>
      )}

      {/* ── Roles tab ── */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          {/* Role selector: horizontal pills (mobile) / stays as pills (desktop too, simpler) */}
          <div className="flex gap-1.5 flex-wrap">
            {CONFIGURABLE_ROLES.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedRole === role
                    ? 'bg-jci-blue text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          {/* Permissions for selected role */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{ROLE_LABELS[selectedRole]} Permissions</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isSuperAdmin ? 'System-reserved — cannot be changed.' : `Permissions for any user with the ${ROLE_LABELS[selectedRole]} role.`}
                </p>
              </div>
              {isSuperAdmin && (
                <Shield size={16} className="text-slate-400 shrink-0" />
              )}
            </div>
            <PermList
              perms={rolePerms[selectedRole]}
              onToggle={(k) => setRolePerms(prev => ({
                ...prev,
                [selectedRole]: { ...prev[selectedRole], [k]: !prev[selectedRole][k] }
              }))}
              disabled={isSuperAdmin}
            />
          </div>
        </div>
      )}

    </div>
  );
};
