import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/Common';
import {
  MembershipConfigService,
  DEFAULT_MEMBERSHIP_RULES,
  computeMembershipTypeFromMember,
  getMemberAge,
  validateMembershipTypeEligibility,
  ComputeMembershipTypeInput,
} from '../../services/membershipConfigService';
import { MembershipRuleConfig, MembershipType } from '../../types';

interface MembershipTypeDisplayProps {
  member: ComputeMembershipTypeInput;
  /** Show age + senatorship hints */
  showDetails?: boolean;
  className?: string;
}

export const MembershipTypeDisplay: React.FC<MembershipTypeDisplayProps> = ({
  member,
  showDetails = true,
  className = '',
}) => {
  const [rules, setRules] = useState<Record<MembershipType, MembershipRuleConfig>>(
    DEFAULT_MEMBERSHIP_RULES
  );

  useEffect(() => {
    MembershipConfigService.getRules().then(setRules).catch(() => {});
  }, []);

  const computedType = useMemo(
    () => computeMembershipTypeFromMember(member, rules),
    [member, rules]
  );

  const age = getMemberAge(member.dateOfBirth);
  const senatorCheck = validateMembershipTypeEligibility(
    {
      membershipType: 'Senator',
      nationality: member.nationality,
      dateOfBirth: member.dateOfBirth,
      senatorCertified: member.senatorCertified,
      senatorshipId: member.senatorshipId,
      role: member.role,
    },
    rules
  );

  const variant =
    computedType === 'Official'
      ? 'success'
      : computedType === 'Probation'
        ? 'warning'
        : computedType === 'Visiting'
          ? 'info'
          : 'neutral';

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={variant as 'success' | 'warning' | 'info' | 'neutral'}>
          {computedType}
        </Badge>
      </div>
    </div>
  );
};

export default MembershipTypeDisplay;
