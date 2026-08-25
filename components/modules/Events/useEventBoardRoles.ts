import { useEffect, useState } from 'react';
import type { Member } from '../../../types';
import { BoardManagementService } from '../../../services/boardManagementService';

export const shortBoardPosition = (position: string): string => {
  const normalizedPosition = position.toLowerCase();
  if (normalizedPosition.includes('immediate past')) return 'IPP';
  if (normalizedPosition.includes('executive vice')) return 'EVP';
  if (normalizedPosition.includes('local organ') || normalizedPosition.includes('lom')) return 'VPLOM';
  if (normalizedPosition.includes('international')) return 'VPIA';
  if (normalizedPosition.includes('individual')) return 'VPI';
  if (normalizedPosition.includes('business')) return 'VPB';
  if (normalizedPosition.includes('community')) return 'VPC';
  if (normalizedPosition.includes('vice president')) return 'VP';
  if (normalizedPosition.includes('president')) return 'Pres';
  if (normalizedPosition.includes('honorary treasurer') || normalizedPosition.includes('treasurer')) return 'HT';
  if (normalizedPosition.includes('secretary general')) return 'SG';
  if (normalizedPosition.includes('secretary')) return 'SG';
  if (normalizedPosition.includes('legal council') || normalizedPosition.includes('legal counsel') || normalizedPosition.includes('glc')) return 'GLC';
  return position;
};

export const useEventBoardRoles = () => {
  const [commissionDirectorIds, setCommissionDirectorIds] = useState<Set<string>>(new Set());
  const [boardMemberIds, setBoardMemberIds] = useState<Set<string>>(new Set());
  const [boardPositions, setBoardPositions] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const currentYear = new Date().getFullYear();

    BoardManagementService.getCurrentBoardMembers()
      .then(docs => {
        const nextCommissionDirectorIds = new Set<string>();
        const nextBoardMemberIds = new Set<string>();
        const nextBoardPositions = new Map<string, string>();

        docs.forEach(data => {
          if (parseInt(String(data.term), 10) !== currentYear) return;

          if (data.memberId) {
            nextBoardMemberIds.add(data.memberId);
            if (data.position) nextBoardPositions.set(data.memberId, data.position);
          }

          const directorIds = ((data as { commissionDirectorIds?: string[] }).commissionDirectorIds ?? []);
          directorIds.forEach(id => nextCommissionDirectorIds.add(id));
        });

        setCommissionDirectorIds(nextCommissionDirectorIds);
        setBoardMemberIds(nextBoardMemberIds);
        setBoardPositions(nextBoardPositions);
      })
      .catch(() => {});
  }, []);

  const getBoardPosition = (member: Member) =>
    boardPositions.get(member.id) ?? member.jciCareer?.currentBoardPosition ?? '';

  const isBoardMember = (member: Member) => boardMemberIds.has(member.id);
  const isDirector = (member: Member) => commissionDirectorIds.has(member.id);

  return {
    getBoardPosition,
    shortBoardPosition,
    isBoardMember,
    isDirector,
  };
};
