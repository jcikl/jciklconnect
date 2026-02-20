import React from 'react';
import { UserRole } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { Button, Badge } from '../ui/Common';
import { User, Shield, Crown, UserCheck } from 'lucide-react';

export const RoleSimulator: React.FC = () => {
  const { isDevMode, simulatedRole, simulateRole, member } = useAuth();

  if (!isDevMode || !member) return null;

  const roles = [
    { value: null, label: 'Developer (All Permissions)', icon: Shield, color: 'bg-purple-100 text-purple-700' },
    { value: UserRole.ADMIN, label: 'Admin', icon: Crown, color: 'bg-red-100 text-red-700' },
    { value: UserRole.BOARD, label: 'Board', icon: Shield, color: 'bg-blue-100 text-blue-700' },
    { value: UserRole.MEMBER, label: 'Member', icon: UserCheck, color: 'bg-green-100 text-green-700' },
    { value: UserRole.GUEST, label: 'Guest', icon: User, color: 'bg-gray-100 text-gray-700' },
  ];

  const currentRole = simulatedRole || 'Developer';
  const currentRoleInfo = roles.find(r => r.value === simulatedRole) || roles[0];

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Shield className="text-purple-600" size={20} />
            <span className="font-semibold text-slate-900">Role Simulator</span>
          </div>
          <Badge variant="info" className={currentRoleInfo.color}>
            {currentRoleInfo.label}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          {roles.map((role) => {
            const Icon = role.icon;
            const isActive = (role.value === null && simulatedRole === null) || role.value === simulatedRole;
            return (
              <Button
                key={role.value || 'dev'}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
                onClick={() => simulateRole(role.value)}
                className="text-xs"
              >
                <Icon size={14} className="mr-1" />
                {role.label.split(' ')[0]}
              </Button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-600 mt-2">
        Simulating: <strong>{currentRoleInfo.label}</strong> - Permissions will reflect this role's access level
      </p>
    </div>
  );
};

