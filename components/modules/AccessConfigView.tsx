import React, { useState, useEffect } from 'react';
import { Save, Shield, Users, UserCog } from 'lucide-react';
import { Button, useToast, Tabs } from '../ui/Common';
import { UserRole } from '../../types';

export const AccessConfigView: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const [boardPermissions, setBoardPermissions] = useState({
    canViewMembers: true,
    canEditMembers: true,
    canViewFinance: true,
    canEditFinance: true,
    canManageProjects: true,
    canManageEvents: true,
    canManageInventory: true,
    canManageAutomation: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveClaims: true,
  });

  const [activeTab, setActiveTab] = useState<'dynamic' | 'roles'>('dynamic');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);

  // Only the 5 core base roles are configurable
  const CONFIGURABLE_ROLES: UserRole[] = [UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE];

  // In a real app, this would be fetched from Firestore / config service
  const [rolePermissions, setRolePermissions] = useState<Record<string, typeof boardPermissions>>({
    [UserRole.GUEST]: { canViewMembers: false, canEditMembers: false, canViewFinance: false, canEditFinance: false, canManageProjects: false, canManageEvents: false, canManageInventory: false, canManageAutomation: false, canViewReports: false, canManageSettings: false, canApproveClaims: false },
    [UserRole.MEMBER]: { canViewMembers: true, canEditMembers: false, canViewFinance: false, canEditFinance: false, canManageProjects: false, canManageEvents: true, canManageInventory: false, canManageAutomation: false, canViewReports: false, canManageSettings: false, canApproveClaims: false },
    [UserRole.ADMIN]: { canViewMembers: true, canEditMembers: true, canViewFinance: true, canEditFinance: true, canManageProjects: true, canManageEvents: true, canManageInventory: true, canManageAutomation: true, canViewReports: true, canManageSettings: true, canApproveClaims: true },
    [UserRole.SUPER_ADMIN]: { canViewMembers: true, canEditMembers: true, canViewFinance: true, canEditFinance: true, canManageProjects: true, canManageEvents: true, canManageInventory: true, canManageAutomation: true, canViewReports: true, canManageSettings: true, canApproveClaims: true },
    [UserRole.INACTIVE]: { canViewMembers: false, canEditMembers: false, canViewFinance: false, canEditFinance: false, canManageProjects: false, canManageEvents: false, canManageInventory: false, canManageAutomation: false, canViewReports: false, canManageSettings: false, canApproveClaims: false },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real app, save to Firestore
      // await SecondaryAccessConfigService.updateBoardPermissions(boardPermissions);
      await new Promise(r => setTimeout(r, 800));
      showToast('Access permissions updated successfully', 'success');
    } catch (e) {
      showToast('Failed to update access permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleBoardPermission = (key: keyof typeof boardPermissions) => {
    setBoardPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRolePermission = (role: string, key: keyof typeof boardPermissions) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield size={24} className="text-jci-blue" />
            Access Permissions Config
          </h2>
          <p className="text-sm text-slate-500">Configure base role permissions and dynamic system privileges.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'dynamic', label: 'Dynamic Assignment (Board)' },
          { id: 'roles', label: 'Base Role Permissions' }
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'dynamic' | 'roles')}
      />

      {activeTab === 'dynamic' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Current Board Members (Dynamic)
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Members who hold a board position in the current calendar year automatically receive these permissions, regardless of their base system role.
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(boardPermissions).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <span className="font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => toggleBoardPermission(key as keyof typeof boardPermissions)}
                    className="w-5 h-5 rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="flex border-b border-slate-200">
            <div className="w-64 border-r border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <UserCog size={16} className="text-slate-500" />
                Select Role
              </h3>
              <div className="space-y-1">
                {CONFIGURABLE_ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedRole === role ? 'bg-jci-blue text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {role.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 p-6 bg-white">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">{selectedRole.replace(/_/g, ' ')} Permissions</h3>
                <p className="text-sm text-slate-500">Configure base permissions granted to any user with the {selectedRole.replace(/_/g, ' ')} role.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rolePermissions[selectedRole] && Object.entries(rolePermissions[selectedRole]).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <span className="font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => toggleRolePermission(selectedRole, key as keyof typeof boardPermissions)}
                      className="w-5 h-5 rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                      disabled={selectedRole === UserRole.SUPER_ADMIN}
                    />
                  </label>
                ))}
              </div>
              {selectedRole === UserRole.SUPER_ADMIN && (
                <p className="mt-4 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                  Note: SUPER_ADMIN permissions are system-reserved and cannot be disabled.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
