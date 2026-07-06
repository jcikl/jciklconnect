import React, { useMemo, useState } from 'react';
import { Shield, CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { Card, Button, Badge, useToast } from '../../ui/Common';
import { Member } from '../../../types';
import { MembersService } from '../../../services/membersService';
import { MembershipTypeDisplay } from '../../shared/MembershipTypeDisplay';
import { useAuth } from '../../../hooks/useAuth';

interface Props {
  members: Member[];
  canValidate: boolean;
  searchQuery?: string;
  onMembersChanged?: () => void;
}

export const SenatorshipManagement: React.FC<Props> = ({
  members,
  canValidate,
  searchQuery = '',
  onMembersChanged,
}) => {
  const { showToast } = useToast();
  const { member: currentUser } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  const term = searchQuery.toLowerCase().trim();

  const { pending, validated } = useMemo(() => {
    const withNumber = members.filter((m) => m.senatorshipId?.trim());
    const matches = (m: Member) =>
      !term ||
      (m.name ?? '').toLowerCase().includes(term) ||
      (m.email ?? '').toLowerCase().includes(term) ||
      (m.fullName ?? '').toLowerCase().includes(term) ||
      (m.senatorshipId ?? '').toLowerCase().includes(term);

    return {
      pending: withNumber.filter((m) => !m.senatorshipBoardValidated && matches(m)),
      validated: withNumber.filter((m) => m.senatorshipBoardValidated && matches(m)),
    };
  }, [members, term]);

  const handleValidate = async (member: Member) => {
    if (!canValidate) return;
    setBusyId(member.id);
    try {
      await MembersService.validateSenatorshipByBoard(
        member.id,
        currentUser?.id || 'unknown',
        currentUser?.name
      );
      showToast(`Validated senatorship for ${member.name}`, 'success');
      onMembersChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Validation failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (member: Member) => {
    if (!canValidate) return;
    if (!window.confirm(`Revoke board validation for ${member.name}? The senatorship number will become editable again.`)) {
      return;
    }
    setBusyId(member.id);
    try {
      await MembersService.revokeSenatorshipValidation(member.id, currentUser?.id);
      showToast(`Revoked validation for ${member.name}`, 'success');
      onMembersChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Revoke failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (member: Member, mode: 'pending' | 'validated') => (
    <div
      key={member.id}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-jci-blue/20 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-jci-blue flex items-center justify-center text-white font-semibold shrink-0 text-sm">
          {(member.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-slate-900 truncate">{member.name}</div>
          {member.fullName && member.fullName !== member.name && (
            <div className="text-sm text-slate-600 truncate">{member.fullName}</div>
          )}
          <div className="text-sm font-mono text-indigo-700 mt-0.5">
            No. {member.senatorshipId}
          </div>
          <div className="mt-1">
            <MembershipTypeDisplay
              member={{
                nationality: member.nationality,
                dateOfBirth: member.dateOfBirth,
                senatorCertified: member.senatorCertified,
                senatorshipId: member.senatorshipId,
                role: member.role,
                membershipType: member.membershipType,
              }}
              showDetails={false}
            />
          </div>
          {mode === 'validated' && member.senatorshipValidatedAt && (
            <p className="text-xs text-slate-500 mt-1">
              Validated {new Date(member.senatorshipValidatedAt).toLocaleDateString()}
              {member.senatorshipValidatedBy ? ` by ${member.senatorshipValidatedBy}` : ''}
            </p>
          )}
        </div>
      </div>
      {canValidate && (
        <div className="flex gap-2 shrink-0">
          {mode === 'pending' ? (
            <Button
              size="sm"
              onClick={() => handleValidate(member)}
              disabled={busyId === member.id}
            >
              {busyId === member.id ? (
                <RefreshCw size={14} className="animate-spin mr-1" />
              ) : (
                <CheckCircle size={14} className="mr-1" />
              )}
              Validate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRevoke(member)}
              disabled={busyId === member.id}
            >
              {busyId === member.id ? (
                <RefreshCw size={14} className="animate-spin mr-1" />
              ) : (
                <XCircle size={14} className="mr-1" />
              )}
              Revoke
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-3">
          <Shield className="text-indigo-600 shrink-0 mt-0.5" size={24} />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900 mb-1">Senatorship validation</p>
            <p>
              Members enter their senatorship number under Membership &amp; Status. Board of Directors
              validates here; once validated, the number cannot be changed in member profiles.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              Pending validation
              <Badge variant="warning">{pending.length}</Badge>
            </span>
          }
        >
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No pending senatorship numbers.</p>
          ) : (
            <div className="space-y-3">{pending.map((m) => renderRow(m, 'pending'))}</div>
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              Validated senators
              <Badge variant="success">{validated.length}</Badge>
            </span>
          }
        >
          {validated.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No validated senators yet.</p>
          ) : (
            <div className="space-y-3">{validated.map((m) => renderRow(m, 'validated'))}</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SenatorshipManagement;
