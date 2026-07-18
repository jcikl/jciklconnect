import * as React from 'react';
import { useState } from 'react';
import { Users, Zap } from 'lucide-react';
import { Modal, Card, Badge, Button } from '../../ui/Common';
import type { Member } from '../../../types';
import type { MentorMatchSuggestion } from '../../../services/mentorshipService';

// Generate an inline SVG data URI with initials — avoids external requests blocked by CSP
const getInitialsSvg = (name: string, size = 48): string => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

interface MentorMatchingModalProps {
  mentee: Member;
  potentialMentors: MentorMatchSuggestion[];
  onSelect: (mentorId: string) => void;
  onClose: () => void;
}

export const MentorMatchingModal: React.FC<MentorMatchingModalProps> = ({ mentee, potentialMentors, onSelect, onClose }) => {
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleSelect = async (mentorId: string) => {
    if (submittingId !== null) return;
    setSubmittingId(mentorId);
    try {
      await onSelect(mentorId);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Find Mentor for ${mentee.name}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Based on {mentee.name}'s profile, here are the best mentor matches:
        </p>

        {potentialMentors.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-slate-500">No suitable mentors found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {potentialMentors.map((match, index) => (
              <Card key={match.mentor.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <img src={match.mentor.avatar || undefined} className="w-12 h-12 rounded-full border border-slate-100" alt="" onError={(e) => { e.currentTarget.src = getInitialsSvg(match.mentor.name, 48); }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900 truncate">{match.mentor.name}</h4>
                        {index === 0 && <Badge variant="success">Best Match</Badge>}
                        <div className="flex items-center gap-1 text-xs text-jci-blue font-bold">
                          <Zap size={10} fill="currentColor" /> {match.matchScore}%
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{match.mentor.role} · {match.mentor.tier}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {Array.isArray(match.mentor.skills) && match.mentor.skills.slice(0, 3).map(skill => (
                          <Badge key={skill} variant="neutral" className="text-[10px] py-0">{skill}</Badge>
                        ))}
                      </div>

                      <div className="bg-blue-50 p-2.5 rounded-lg">
                        <p className="text-[11px] font-bold text-blue-900 mb-1">Why this match?</p>
                        <ul className="text-[11px] text-blue-700 space-y-0.5">
                          {Array.isArray(match.reasons) && match.reasons.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="mt-1 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleSelect(match.mentor.id)} disabled={submittingId !== null}>{submittingId === match.mentor.id ? 'Selecting…' : 'Select'}</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
