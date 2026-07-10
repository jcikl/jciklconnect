import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Users, Plus, Trash2, ChevronRight, Award, Shield, RefreshCw, Camera, Quote, Tag, AlignLeft, ImageIcon } from 'lucide-react';
import { Card, Button, useToast, Badge, Modal } from '../../ui/Common';
import { Select, Input } from '../../ui/Form';
import { MemberSelector } from '../../ui/MemberSelector';
import { BoardManagementService } from '../../../services/boardManagementService';
import { uploadBoardAvatarToCloudinary, uploadPresidentialLogoToCloudinary, uploadBodGroupPhotoToCloudinary, uploadMemberGroupPhotoToCloudinary, deleteFromCloudinary } from '../../../services/cloudinaryService';
import { BoardMember, BoardTermSettings, Member } from '../../../types';

const POSITION_ORDER: Record<string, number> = {
  'President': 1,
  'Immediate Past President': 2,
  'Executive Vice President': 3,
  'General Legal Council': 4,
  'Secretary': 5,
  'Honorary Treasurer': 6,
  'Vice President (Individual)': 7,
  'Vice President (Business)': 8,
  'Vice President (Community)': 9,
  'Vice President (International Affairs)': 10,
  'Vice President (LOM)': 11,
  'Area Officer': 12,
  'National Officer': 13,
  'JCI Officer': 14,
};

/** Board è®¾å®šå¼¹çª—çš„èŒä½åˆ†ç»„æ ‡ç­¾ */
const POSITION_GROUPS: { key: string; label: string; positions: string[] }[] = [
  {
    key: 'exco',
    label: 'EXCO',
    positions: ['President', 'Immediate Past President', 'Secretary', 'Honorary Treasurer', 'General Legal Council', 'Executive Vice President'],
  },
  {
    key: 'vp',
    label: 'VP',
    positions: ['Vice President (Individual)', 'Vice President (Business)', 'Vice President (Community)', 'Vice President (International Affairs)', 'Vice President (LOM)'],
  },
  { key: 'area', label: 'Area Officer', positions: ['Area Officer'] },
  { key: 'national', label: 'National Officer', positions: ['National Officer'] },
  { key: 'jci', label: 'JCI Officer', positions: ['JCI Officer'] },
];

interface BoardOfDirectorsSectionProps {
  members: Member[];
  canManage: boolean;
}

interface TermSummary {
  year: string;
  presidentName: string;
  totalMembers: number;
}

export const BoardOfDirectorsSection: React.FC<BoardOfDirectorsSectionProps> = ({ members, canManage }) => {
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<TermSummary[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // States for the management modal
  const [assignments, setAssignments] = useState<Record<string, {
    memberId: string;
    commissionDirectorIds: string[];
    boardAvatarUrl?: string;
    commissionDirectorAvatars?: Record<string, string>;
  }>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [groupPhotoUploading, setGroupPhotoUploading] = useState(false);
  const [groupPhotoUploadProgress, setGroupPhotoUploadProgress] = useState(0);
  const [memberGroupPhotoUploading, setMemberGroupPhotoUploading] = useState(false);
  const [memberGroupPhotoUploadProgress, setMemberGroupPhotoUploadProgress] = useState(0);
  const [termSettings, setTermSettings] = useState<Partial<BoardTermSettings>>({});
  const { showToast } = useToast();

  const positions = BoardManagementService.getDefaultBoardPositions();
  const [activePositionGroup, setActivePositionGroup] = useState<string>('exco');

  const handleBodAvatarUpload = async (
    member: Member,
    file: File,
    position: string,
    type: 'board' | 'commission'
  ) => {
    if (!selectedTerm) return;
    const key = type === 'board' ? `${position}:board` : `${position}:commission:${member.id}`;
    setUploadingKey(key);
    setUploadProgress(0);
    try {
      const oldUrl = type === 'board'
        ? assignments[position]?.boardAvatarUrl || ''
        : assignments[position]?.commissionDirectorAvatars?.[member.id] || '';

      const url = await uploadBoardAvatarToCloudinary(file, member, selectedTerm, (p) => setUploadProgress(p));

      if (oldUrl && oldUrl !== url) {
        deleteFromCloudinary(oldUrl).catch(console.error);
      }

      if (type === 'board') {
        setAssignments(prev => ({
          ...prev,
          [position]: { ...prev[position], boardAvatarUrl: url }
        }));
      } else {
        setAssignments(prev => ({
          ...prev,
          [position]: {
            ...prev[position],
            commissionDirectorAvatars: {
              ...(prev[position].commissionDirectorAvatars || {}),
              [member.id]: url
            }
          }
        }));
      }
      showToast(`Photo updated for ${member.name}`, 'success');
    } catch (err) {
      showToast('Failed to upload photo', 'error');
    } finally {
      setUploadingKey(null);
      setUploadProgress(0);
    }
  };

  const loadTerms = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: currentYear - 1954 + 1 }, (_, i) => String(1954 + i));

      const summaries: TermSummary[] = await Promise.all(years.map(async (year) => {
        const board = await BoardManagementService.getBoardMembersByYear(year);
        const president = board.find(m => m.position === 'President' && m.isActive);
        const presidentName = president ? members.find(m => m.id === president.memberId)?.name || 'Unknown' : 'Not Set';
        return {
          year,
          presidentName,
          totalMembers: board.filter(m => m.isActive).length
        };
      }));

      setTerms(summaries.sort((a, b) => b.year.localeCompare(a.year)));

      // Ensure member docs reflect current-year board (grants Access Permissions / isBoard)
      await BoardManagementService.syncCurrentYearBoardAssignees().catch((err) => {
        console.warn('Current-year board member sync skipped:', err);
      });
    } catch (err) {
      console.error('Failed to load board terms:', err);
      showToast('Failed to load board summaries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, [members]);

  const handleOpenManage = async (year: string, forceEdit = false) => {
    setSelectedTerm(year);
    setIsEditing(forceEdit);
    setLoading(true);
    try {
      const [boardMembers, ts] = await Promise.all([
        BoardManagementService.getBoardMembersByYear(year),
        BoardManagementService.getBoardTermSettings(year),
      ]);
      setTermSettings(ts || {});
      const map: Record<string, {
        memberId: string;
        commissionDirectorIds: string[];
        boardAvatarUrl?: string;
        commissionDirectorAvatars?: Record<string, string>;
      }> = {};

      positions.forEach(pos => {
        const found = boardMembers.find(bm => bm.position === pos && bm.isActive);
        map[pos] = {
          memberId: found?.memberId || '',
          commissionDirectorIds: found?.commissionDirectorIds || [],
          boardAvatarUrl: found?.boardAvatarUrl || '',
          commissionDirectorAvatars: found?.commissionDirectorAvatars || {},
        };
      });

      setAssignments(map);
      setShowManageModal(true);
    } catch (err) {
      showToast('Failed to load board details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = (position: string, memberId: string) => {
    setAssignments(prev => ({
      ...prev,
      [position]: { ...prev[position], memberId }
    }));
  };

  const handleAddCommissionDirector = (position: string, memberId: string) => {
    if (!memberId) return;
    setAssignments(prev => {
      const current = prev[position].commissionDirectorIds;
      if (current.includes(memberId)) return prev;
      return {
        ...prev,
        [position]: {
          ...prev[position],
          commissionDirectorIds: [...current, memberId]
        }
      };
    });
  };

  const handleRemoveCommissionDirector = (position: string, memberId: string) => {
    setAssignments(prev => ({
      ...prev,
      [position]: {
        ...prev[position],
        commissionDirectorIds: prev[position].commissionDirectorIds.filter(id => id !== memberId)
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedTerm) return;
    setSaving(true);
    try {
      const list = Object.entries(assignments)
        .filter(([_, data]) => data.memberId)
        .map(([position, data]) => ({
          position,
          memberId: data.memberId,
          commissionDirectorIds: data.commissionDirectorIds,
          boardAvatarUrl: data.boardAvatarUrl || undefined,
          commissionDirectorAvatars: data.commissionDirectorAvatars,
        }));

      await Promise.all([
        BoardManagementService.setBoardForTerm(selectedTerm, list),
        BoardManagementService.setBoardTermSettings(selectedTerm, {
          presidentTheme: termSettings.presidentTheme,
          tagline: termSettings.tagline,
          shortDescription: termSettings.shortDescription,
          logoUrl: termSettings.logoUrl,
          groupPhotoUrl: termSettings.groupPhotoUrl,
          memberGroupPhotoUrl: termSettings.memberGroupPhotoUrl,
        }),
      ]);
      // Sync member docs immediately after save so replaced members lose board flags
      await BoardManagementService.syncCurrentYearBoardAssignees().catch(() => {});
      showToast(`Board for ${selectedTerm} updated successfully`, 'success');
      setShowManageModal(false);
      loadTerms();
    } catch (err) {
      showToast('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const nameA = (a.fullName || a.name || '').toLowerCase();
      const nameB = (b.fullName || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  const getMemberLabel = (m: Member) => {
    if (!m) return '';
    const namePart = m.name;
    const fullNamePart = m.fullName || '';
    const idPart = m.idNumber ? `(${m.idNumber})` : '';

    if (fullNamePart || idPart) {
      return `${fullNamePart} ${idPart} - ${namePart}`.trim();
    }
    return namePart;
  };

  const allAssignedIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(assignments).forEach(data => {
      if (data.memberId) ids.add(data.memberId);
      data.commissionDirectorIds.forEach(id => ids.add(id));
    });
    return ids;
  }, [assignments]);

  const assignedPositions = useMemo(() => {
    return Object.entries(assignments)
      .filter(([_, data]) => data.memberId)
      .sort((a, b) => {
        const orderA = POSITION_ORDER[a[0]] || 99;
        const orderB = POSITION_ORDER[b[0]] || 99;
        return orderA - orderB;
      });
  }, [assignments]);

  if (loading && terms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <RefreshCw className="w-10 h-10 text-slate-300 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Synchronizing Board Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {canManage && (
          <Button
            variant="outline"
            className="w-full md:w-auto flex items-center justify-center gap-2"
            onClick={() => handleOpenManage(String(new Date().getFullYear() + 1), true)}
          >
            <Plus size={16} /> Setup Next Year
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {terms.map((term) => (
          <div
            key={term.year}
            onClick={() => handleOpenManage(term.year, false)}
            className="group relative bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-xl hover:border-jci-blue transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Award size={80} className="text-jci-blue" />
            </div>

            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="flex-shrink-0">
                <h3 className="text-2xl font-black text-slate-900 leading-none">{term.year}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Term</p>
              </div>

              <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">President</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{term.presidentName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Board</p>
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-sm font-black text-jci-blue">{term.totalMembers}</span>
                    <Users size={10} className="text-jci-blue/60" />
                  </div>
                </div>
              </div>

              <ChevronRight className="text-slate-300 group-hover:text-jci-blue transition-colors shrink-0" size={18} />
            </div>

            <div className="space-y-4 relative z-10">
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={isEditing ? `Configure Board of Directors - ${selectedTerm}` : `Board of Directors Directory - ${selectedTerm}`}
        size="xl"
        drawerOnMobile
        footer={
          <div className="flex gap-3 w-full">
            {isEditing ? (
              <>
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                  Back to Directory
                </Button>
                {canManage && (
                  <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                    <Save size={18} /> {saving ? 'Saving...' : 'Update Board'}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1" onClick={() => setShowManageModal(false)}>
                  Close
                </Button>
                {canManage && (
                  <Button className="flex-1 gap-2 bg-jci-blue hover:bg-jci-blue/90" onClick={() => setIsEditing(true)}>
                    Manage Assignees
                  </Button>
                )}
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              {/* Presidential Identity */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 flex items-center justify-center">
                    <Award size={15} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Presidential Identity</h4>
                    <p className="text-[10px] text-slate-500">Displayed on the guest home page President Spotlight</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
                      <Quote size={11} /> Presidential Theme
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                      placeholder="e.g. Ignite. Lead. Transform."
                      value={termSettings.presidentTheme || ''}
                      onChange={e => setTermSettings(prev => ({ ...prev, presidentTheme: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
                      <Tag size={11} /> Tagline
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                      placeholder="e.g. Empowering Young Leaders"
                      value={termSettings.tagline || ''}
                      onChange={e => setTermSettings(prev => ({ ...prev, tagline: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
                      <AlignLeft size={11} /> Short Description
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 resize-none"
                      placeholder="A brief message from the president about this year's direction..."
                      value={termSettings.shortDescription || ''}
                      onChange={e => setTermSettings(prev => ({ ...prev, shortDescription: e.target.value }))}
                    />
                  </div>
                  {/* Theme Logo card */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                        <ImageIcon size={11} /> Theme Logo
                      </label>
                    </div>
                    <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200" style={{ aspectRatio: '16/9' }}>
                      {termSettings.logoUrl
                        ? <img src={termSettings.logoUrl} alt="logo" className="w-full h-full object-contain p-4" />
                        : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5"><ImageIcon size={20} className="text-slate-300" /><span className="text-[10px] text-slate-400 font-medium">No logo</span></div>}
                      <div className="absolute inset-0 flex items-end justify-between p-2 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                        <label className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold bg-white/90 text-slate-700 cursor-pointer hover:bg-white transition-colors shadow-sm">
                          <Camera size={10} /> {termSettings.logoUrl ? 'Replace' : 'Upload'}
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const f = e.target.files?.[0]; e.target.value = '';
                            if (!f || !selectedTerm) return;
                            setLogoUploading(true); setLogoUploadProgress(0);
                            try {
                              const url = await uploadPresidentialLogoToCloudinary(f, selectedTerm, p => setLogoUploadProgress(p));
                              if (termSettings.logoUrl) deleteFromCloudinary(termSettings.logoUrl).catch(() => {});
                              setTermSettings(prev => ({ ...prev, logoUrl: url }));
                              showToast('Logo uploaded', 'success');
                            } catch { showToast('Upload failed', 'error'); }
                            finally { setLogoUploading(false); setLogoUploadProgress(0); }
                          }} />
                        </label>
                        {termSettings.logoUrl && (
                          <button onClick={() => setTermSettings(prev => ({ ...prev, logoUrl: '' }))} className="w-7 h-7 rounded-lg bg-white/90 hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shadow-sm">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      {logoUploading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 px-4">
                          <p className="text-xs text-white font-bold">Uploadingâ€¦</p>
                          <div className="w-full h-1.5 rounded-full bg-white/30 overflow-hidden"><div className="h-full bg-white transition-all rounded-full" style={{ width: `${logoUploadProgress}%` }} /></div>
                        </div>
                      )}
                    </div>
                    {!logoUploading && (
                      <label className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 cursor-pointer transition-colors bg-white">
                        <Camera size={11} /> {termSettings.logoUrl ? 'Replace logo' : 'Upload logo'}
                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                          const f = e.target.files?.[0]; e.target.value = '';
                          if (!f || !selectedTerm) return;
                          setLogoUploading(true); setLogoUploadProgress(0);
                          try {
                            const url = await uploadPresidentialLogoToCloudinary(f, selectedTerm, p => setLogoUploadProgress(p));
                            if (termSettings.logoUrl) deleteFromCloudinary(termSettings.logoUrl).catch(() => {});
                            setTermSettings(prev => ({ ...prev, logoUrl: url }));
                            showToast('Logo uploaded', 'success');
                          } catch { showToast('Upload failed', 'error'); }
                          finally { setLogoUploading(false); setLogoUploadProgress(0); }
                        }} />
                      </label>
                    )}
                  </div>
                  {/* Group Photos â€” side by side cards */}
                  {([
                    {
                      key: 'groupPhotoUrl' as const,
                      label: 'BOD Group Photo',
                      dest: 'About page',
                      color: 'blue',
                      uploading: groupPhotoUploading,
                      progress: groupPhotoUploadProgress,
                      onUpload: async (f: File) => {
                        setGroupPhotoUploading(true); setGroupPhotoUploadProgress(0);
                        try {
                          const url = await uploadBodGroupPhotoToCloudinary(f, selectedTerm!, p => setGroupPhotoUploadProgress(p));
                          if (termSettings.groupPhotoUrl) deleteFromCloudinary(termSettings.groupPhotoUrl).catch(() => {});
                          setTermSettings(prev => ({ ...prev, groupPhotoUrl: url }));
                          showToast('BOD group photo uploaded', 'success');
                        } catch { showToast('Upload failed', 'error'); }
                        finally { setGroupPhotoUploading(false); setGroupPhotoUploadProgress(0); }
                      },
                      onClear: () => setTermSettings(prev => ({ ...prev, groupPhotoUrl: '' })),
                      url: termSettings.groupPhotoUrl,
                    },
                    {
                      key: 'memberGroupPhotoUrl' as const,
                      label: 'Member Group Photo',
                      dest: 'Home hero',
                      color: 'sky',
                      uploading: memberGroupPhotoUploading,
                      progress: memberGroupPhotoUploadProgress,
                      onUpload: async (f: File) => {
                        setMemberGroupPhotoUploading(true); setMemberGroupPhotoUploadProgress(0);
                        try {
                          const url = await uploadMemberGroupPhotoToCloudinary(f, selectedTerm!, p => setMemberGroupPhotoUploadProgress(p));
                          if (termSettings.memberGroupPhotoUrl) deleteFromCloudinary(termSettings.memberGroupPhotoUrl).catch(() => {});
                          setTermSettings(prev => ({ ...prev, memberGroupPhotoUrl: url }));
                          showToast('Member group photo uploaded', 'success');
                        } catch { showToast('Upload failed', 'error'); }
                        finally { setMemberGroupPhotoUploading(false); setMemberGroupPhotoUploadProgress(0); }
                      },
                      onClear: () => setTermSettings(prev => ({ ...prev, memberGroupPhotoUrl: '' })),
                      url: termSettings.memberGroupPhotoUrl,
                    },
                  ] as const).map(item => (
                    <div key={item.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                          <Camera size={11} /> {item.label}
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">{item.dest}</span>
                      </div>
                      <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200" style={{ aspectRatio: '16/9' }}>
                        {item.url
                          ? <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                          : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                              <Camera size={20} className="text-slate-300" />
                              <span className="text-[10px] text-slate-400 font-medium">No photo</span>
                            </div>
                          )}
                        {/* Overlay actions */}
                        <div className="absolute inset-0 flex items-end justify-between p-2 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                          <label className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold bg-white/90 text-slate-700 cursor-pointer hover:bg-white transition-colors shadow-sm">
                            <Camera size={10} /> {item.url ? 'Replace' : 'Upload'}
                            <input type="file" accept="image/*" className="hidden" onChange={async e => {
                              const f = e.target.files?.[0]; e.target.value = '';
                              if (!f) return;
                              await item.onUpload(f);
                            }} />
                          </label>
                          {item.url && (
                            <button onClick={item.onClear} className="w-7 h-7 rounded-lg bg-white/90 hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shadow-sm">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        {/* Upload progress overlay */}
                        {item.uploading && (
                          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 px-6">
                            <p className="text-xs text-white font-bold">Uploadingâ€¦</p>
                            <div className="w-full h-1.5 rounded-full bg-white/30 overflow-hidden">
                              <div className="h-full bg-white transition-all rounded-full" style={{ width: `${item.progress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Static fallback upload button (touch-friendly, no hover needed) */}
                      {!item.uploading && (
                        <label className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 cursor-pointer transition-colors bg-white">
                          <Camera size={11} /> {item.url ? 'Replace photo' : 'Upload photo'}
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const f = e.target.files?.[0]; e.target.value = '';
                            if (!f) return;
                            await item.onUpload(f);
                          }} />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Position group tabs */}
              <div className="flex gap-1.5 flex-wrap sticky top-0 z-10 bg-white py-2 -my-2">
                {POSITION_GROUPS.map(group => {
                  const assignedCount = group.positions.filter(p => assignments[p]?.memberId).length;
                  const isActive = activePositionGroup === group.key;
                  return (
                    <button
                      key={group.key}
                      onClick={() => setActivePositionGroup(group.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        isActive ? 'bg-jci-blue text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {group.label}
                      <span className={`text-[10px] font-black ${isActive ? 'text-white/70' : assignedCount === group.positions.length ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {assignedCount}/{group.positions.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {positions.filter(p => (POSITION_GROUPS.find(g => g.key === activePositionGroup)?.positions || []).includes(p)).map(position => (
                <div key={position} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                        <Award size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{position}</h4>
                        <p className="text-xs text-slate-500">Assignment for {selectedTerm}</p>
                      </div>
                    </div>

                    <div className="w-full sm:w-80">
                      <MemberSelector
                        label=""
                        members={sortedMembers.filter(m => !allAssignedIds.has(m.id) || m.id === (assignments[position]?.memberId || ''))}
                        getOptionLabel={getMemberLabel}
                        value={assignments[position]?.memberId || ''}
                        onChange={(id) => handleAssignmentChange(position, id)}
                        selfOption={false}
                        showLookupFields={false}
                        placeholder="Search member..."
                        disabled={!canManage}
                      />
                    </div>
                  </div>

                  {assignments[position]?.memberId && (() => {
                    const sel = members.find(m => m.id === assignments[position].memberId);
                    if (!sel) return null;
                    const boardAvatar = assignments[position]?.boardAvatarUrl || '';
                    const avatarSrc = boardAvatar || sel.avatar || sel.avatarUrl || '';
                    const isUp = uploadingKey === `${position}:board`;
                    return (
                      <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {avatarSrc
                            ? <img src={avatarSrc} alt={sel.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">{sel.name.charAt(0)}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{sel.name}</p>
                          {boardAvatar && <p className="text-[10px] text-jci-blue font-medium">Board photo set</p>}
                          {isUp && <div className="mt-1 h-1 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-jci-blue transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
                        </div>
                        <label className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${isUp ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-100 hover:bg-blue-50 hover:text-jci-blue text-slate-600 cursor-pointer'}`}>
                          <Camera size={12} />
                          {isUp ? 'Uploading...' : 'Photo'}
                          <input type="file" accept="image/*" className="hidden" disabled={isUp} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleBodAvatarUpload(sel, f, position, 'board'); }} />
                        </label>
                      </div>
                    );
                  })()}

                  {assignments[position]?.memberId && (
                    <div className="pt-4 border-t border-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commission Directors</h5>
                        {canManage && (
                          <div className="w-80">
                            <MemberSelector
                              label=""
                              members={sortedMembers.filter(m => !allAssignedIds.has(m.id))}
                              getOptionLabel={getMemberLabel}
                              value=""
                              onChange={(id) => handleAddCommissionDirector(position, id)}
                              selfOption={false}
                              showLookupFields={false}
                              placeholder="+ Add Director"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {assignments[position].commissionDirectorIds.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No commission directors assigned</p>
                        ) : (
                          assignments[position].commissionDirectorIds.map(id => {
                            const m = members.find(mem => mem.id === id);
                            const dirBoardAvatar = assignments[position]?.commissionDirectorAvatars?.[id] || '';
                            const dirAvatar = dirBoardAvatar || m?.avatar || m?.avatarUrl || '';
                            const isDirUp = uploadingKey === `${position}:commission:${id}`;
                            return (
                              <div key={id} className="flex items-center gap-1.5 bg-slate-50 pl-1.5 pr-1 py-1 rounded-full border border-slate-200">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 shrink-0">
                                  {dirAvatar
                                    ? <img src={dirAvatar} alt={m?.name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500">{m?.name?.charAt(0)}</div>}
                                </div>
                                <span className="text-xs font-medium text-slate-700">{m?.name || 'Unknown'}</span>
                                {canManage && (
                                  <>
                                    <label className={`transition-colors rounded-full p-0.5 ${isDirUp ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-jci-blue cursor-pointer'}`} title="Upload photo">
                                      <Camera size={11} />
                                      <input type="file" accept="image/*" className="hidden" disabled={isDirUp || !m} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f && m) handleBodAvatarUpload(m, f, position, 'commission'); }} />
                                    </label>
                                    <button onClick={() => handleRemoveCommissionDirector(position, id)} className="hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors p-0.5">
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Presidential Identity summary */}
              {(termSettings.presidentTheme || termSettings.tagline || termSettings.shortDescription || termSettings.logoUrl || termSettings.groupPhotoUrl || termSettings.memberGroupPhotoUrl) && (
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 space-y-3">
                  {(termSettings.presidentTheme || termSettings.tagline || termSettings.shortDescription) && (
                    <div className="min-w-0">
                      {termSettings.presidentTheme && (
                        <p className="text-sm font-black text-slate-800 leading-snug">{termSettings.presidentTheme}</p>
                      )}
                      {termSettings.tagline && (
                        <p className="text-xs font-semibold text-amber-600 mt-0.5">{termSettings.tagline}</p>
                      )}
                      {termSettings.shortDescription && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{termSettings.shortDescription}</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative rounded-lg overflow-hidden border border-amber-200 bg-white" style={{ aspectRatio: '16/9' }}>
                      {termSettings.logoUrl ? (
                        <img src={termSettings.logoUrl} alt="Theme Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Award size={14} className="text-amber-300" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5">
                        <p className="text-[8px] font-black text-white uppercase tracking-wide leading-none">Logo</p>
                      </div>
                    </div>
                    <div className="relative rounded-lg overflow-hidden border border-amber-200 bg-amber-50" style={{ aspectRatio: '16/9' }}>
                      {termSettings.groupPhotoUrl ? (
                        <img src={termSettings.groupPhotoUrl} alt="BOD Group" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users size={14} className="text-amber-300" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5">
                        <p className="text-[8px] font-black text-white uppercase tracking-wide leading-none">BOD</p>
                      </div>
                    </div>
                    <div className="relative rounded-lg overflow-hidden border border-amber-200 bg-amber-50" style={{ aspectRatio: '16/9' }}>
                      {termSettings.memberGroupPhotoUrl ? (
                        <img src={termSettings.memberGroupPhotoUrl} alt="Member Group" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users size={14} className="text-amber-300" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5">
                        <p className="text-[8px] font-black text-white uppercase tracking-wide leading-none">Members</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {assignedPositions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-slate-500 font-medium">No board members assigned for this term.</p>
                  {canManage && (
                    <Button size="sm" className="mt-4" onClick={() => setIsEditing(true)}>
                      Start Setup
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {assignedPositions.map(([position, data]) => {
                    const bm = members.find(m => m.id === data.memberId);
                    if (!bm) return null;
                    const isPresident = position === 'President';
                    const directors = data.commissionDirectorIds
                      .map(id => members.find(m => m.id === id))
                      .filter(Boolean) as Member[];

                    return (
                      <div
                        key={position}
                        className={`rounded-2xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${isPresident
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-md col-span-1 sm:col-span-2'
                            : 'bg-white border-slate-100 shadow-sm'
                          }`}
                      >
                        {isPresident && (
                          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                            President
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <img
                            src={data.boardAvatarUrl || bm.avatar || bm.avatarUrl || undefined}
                            alt={bm.name}
                            className={`rounded-xl object-cover bg-slate-100 border shrink-0 ${isPresident ? 'w-16 h-16 border-blue-300' : 'w-12 h-12 border-slate-200'
                              }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{position}</p>
                            <h4 className={`font-black text-slate-900 truncate ${isPresident ? 'text-lg' : 'text-sm'}`}>
                              {bm.fullName || bm.name}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">{bm.companyName || (bm.business?.position) || 'JCI Member'}</p>
                          </div>
                        </div>

                        {directors.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100/80">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">Commission Directors</p>
                            <div className="flex flex-wrap gap-2">
                              {directors.map(dir => (
                                <div key={dir.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-full pl-1.5 pr-3 py-0.5 max-w-[200px] truncate">
                                  <img src={data.commissionDirectorAvatars?.[dir.id] || dir.avatar || dir.avatarUrl || undefined} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
                                  <span className="text-[10px] font-semibold text-slate-600 truncate">{dir.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

