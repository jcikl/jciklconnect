import React, { useState, useEffect } from 'react';

// Generate an inline SVG data URI with initials — avoids external ui-avatars.com requests blocked by CSP
const getInitialsSvg = (name: string, size = 200): string => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
import { Users, Calendar, Plus, Heart, Edit, Trash2 } from 'lucide-react';
import { Card, Button, AvatarGroup, Badge, Modal, useToast, PageHeader, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useHobbyClubs } from '../../hooks/useHobbyClubs';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { HobbyClub, ClubActivity } from '../../types';
import { Tabs } from '../ui/Common';

export const HobbyClubsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedClub, setSelectedClub] = useState<HobbyClub | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'clubs' | 'activities'>('clubs');
    const { clubs, loading, error, createClub, updateClub, deleteClub, joinClub, leaveClub, scheduleActivity, updateActivity, deleteActivity, getClubMembers } = useHobbyClubs();
    const { member } = useAuth();
    const { members } = useMembers();
    const { showToast } = useToast();

    const filteredClubs = React.useMemo(() => {
        const term = (searchQuery || '').toLowerCase();
        if (!term) return clubs;
        return clubs.filter(club =>
            (club.name ?? '').toLowerCase().includes(term) ||
            (club.category ?? '').toLowerCase().includes(term) ||
            (club.lead ?? '').toLowerCase().includes(term) ||
            (club.nextActivity ?? '').toLowerCase().includes(term)
        );
    }, [clubs, searchQuery]);

    const handleCreateClub = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        try {
            const newClub: Omit<HobbyClub, 'id' | 'membersCount'> = {
                name: formData.get('name') as string,
                category: (formData.get('category') as HobbyClub['category']) || 'Social',
                lead: member?.name || '',
                image: formData.get('image') as string || getInitialsSvg(formData.get('name') as string, 200),
            };

            await createClub(newClub);
            setCreateModalOpen(false);
            e.currentTarget.reset();
        } catch (err) {
            // Error is handled in the hook
        }
    }

    const handleUpdateClub = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedClub) return;

        const formData = new FormData(e.currentTarget);

        setIsSaving(true);
        try {
            await updateClub(selectedClub.id, {
                name: formData.get('name') as string,
                category: (formData.get('category') as HobbyClub['category']) || 'Social',
                image: formData.get('image') as string || selectedClub.image,
            });
            setEditModalOpen(false);
            setSelectedClub(null);
        } catch (err) {
            // Error is handled in the hook
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClub = (clubId: string) => {
        setConfirmState({
            open: true,
            title: 'Delete Club',
            message: 'Are you sure you want to delete this club?',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmState(CONFIRM_CLOSED);
                try {
                    await deleteClub(clubId);
                } catch (err) {
                    // Error is handled in the hook
                }
            },
        });
    };

    const isOwner = (club: HobbyClub) => {
        return member && club.lead === member.name;
    };

    const CATEGORY_STYLES: Record<string, string> = {
        Sports: 'bg-emerald-500 text-white',
        Social: 'bg-amber-500 text-white',
        Professional: 'bg-jci-blue text-white',
        Arts: 'bg-purple-500 text-white',
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Hobby Clubs" description="Connect with members beyond formal projects." />

            <Card noPadding>
                <div className="px-4 md:px-6 pt-4">
                    <Tabs
                        tabs={[{id: 'clubs', label: 'Clubs'}, {id: 'activities', label: 'Activities'}]}
                        activeTab={activeTab}
                        onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
                    />
                </div>
                <div className="p-4">
                    {activeTab === 'clubs' ? (
                        <LoadingState loading={loading} error={error} empty={filteredClubs.length === 0} emptyMessage="No hobby clubs found">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {/* Start new club card */}
                                <button
                                    className="group flex flex-col items-center justify-center gap-3 min-h-[220px] rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-jci-blue/40 hover:text-jci-blue hover:bg-blue-50/30 transition-all"
                                    onClick={() => setCreateModalOpen(true)}
                                >
                                    <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-current flex items-center justify-center">
                                        <Plus size={20} />
                                    </div>
                                    <span className="font-bold text-sm">Start New Club</span>
                                </button>
                                {filteredClubs.map(club => (
                                    <div key={club.id} className="group flex flex-col bg-white rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">
                                        {/* Cover */}
                                        <div className="relative h-36 bg-slate-100 overflow-hidden">
                                            <img src={club.image} alt={club.name}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                                            {/* Category badge */}
                                            <span className={`absolute top-2.5 right-2.5 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full backdrop-blur-sm ${CATEGORY_STYLES[club.category] || 'bg-slate-500/90 text-white'}`}>
                                                {club.category}
                                            </span>
                                            {/* Owner actions */}
                                            {isOwner(club) && (
                                                <div className="absolute top-2.5 left-2.5 flex gap-1">
                                                    <button
                                                        className="p-1.5 rounded-lg bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors"
                                                        onClick={() => { setSelectedClub(club); setEditModalOpen(true); }}
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        className="p-1.5 rounded-lg bg-black/30 backdrop-blur-md text-white/90 hover:bg-red-500/80 transition-colors"
                                                        onClick={() => handleDeleteClub(club.id)}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                            {/* Name on cover */}
                                            <h3 className="absolute bottom-2.5 left-3.5 right-3.5 text-white font-black text-lg leading-tight drop-shadow line-clamp-1">
                                                {club.name}
                                            </h3>
                                        </div>

                                        {/* Body */}
                                        <div className="flex flex-col flex-1 p-3.5 gap-3">
                                            {/* Members + Lead */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <AvatarGroup count={club.membersCount} />
                                                    <span className="text-xs text-slate-400 font-medium">{club.membersCount || 0} member{(club.membersCount || 0) !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div className="text-right min-w-0">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lead</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate max-w-[110px]">{club.lead}</p>
                                                </div>
                                            </div>

                                            {/* Next activity */}
                                            {club.nextActivity ? (
                                                <div className="flex items-start gap-2 bg-jci-blue/5 border border-jci-blue/10 rounded-xl px-3 py-2">
                                                    <Calendar size={13} className="text-jci-blue mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-jci-blue">Next Activity</p>
                                                        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">{club.nextActivity}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 text-slate-400">
                                                    <Calendar size={13} className="shrink-0" />
                                                    <p className="text-xs font-medium">No upcoming activity</p>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="mt-auto flex gap-2">
                                                {isOwner(club) ? (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1"
                                                            onClick={() => { setSelectedClub(club); setIsMembersModalOpen(true); }}
                                                        >
                                                            <Users size={14} className="mr-2" />
                                                            Members
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => { setSelectedClub(club); setIsActivityModalOpen(true); }}
                                                        >
                                                            <Calendar size={14} />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            className="flex-1"
                                                            onClick={() => joinClub(club.id)}
                                                            disabled={!member}
                                                        >
                                                            <Heart size={14} className="mr-2" />
                                                            Join Club
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => { setSelectedClub(club); setIsMembersModalOpen(true); }}
                                                        >
                                                            <Users size={14} />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </LoadingState>
                    ) : (
                        <ClubActivitiesTab
                            clubs={filteredClubs}
                            canManage={(club) => !!isOwner(club)}
                            onManage={(club) => { setSelectedClub(club); setIsActivityModalOpen(true); }}
                        />
                    )}
                </div>
            </Card>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Create Hobby Club"
                size="lg"
                drawerOnMobile
            >
                <form onSubmit={handleCreateClub} className="space-y-4">
                    <Input name="name" label="Club Name" placeholder="e.g. Chess Club" required />
                    <Select name="category" label="Category" options={[
                        { label: 'Sports', value: 'Sports' },
                        { label: 'Social', value: 'Social' },
                        { label: 'Professional', value: 'Professional' },
                        { label: 'Arts', value: 'Arts' }
                    ]} required />
                    <Input name="image" label="Image URL" type="url" placeholder="https://..." />
                    <div className="pt-4">
                        <Button className="w-full" type="submit" disabled={!member}>Create Club</Button>
                    </div>
                </form>
            </Modal>

            {selectedClub && (
                <Modal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setEditModalOpen(false);
                        setSelectedClub(null);
                    }}
                    title="Edit Hobby Club"
                    size="lg"
                    drawerOnMobile
                >
                    <form onSubmit={handleUpdateClub} className="space-y-4">
                        <Input name="name" label="Club Name" defaultValue={selectedClub.name} required />
                        <Select name="category" label="Category" options={[
                            { label: 'Sports', value: 'Sports' },
                            { label: 'Social', value: 'Social' },
                            { label: 'Professional', value: 'Professional' },
                            { label: 'Arts', value: 'Arts' }
                        ]} defaultValue={selectedClub.category} required />
                        <Input name="image" label="Image URL" type="url" defaultValue={selectedClub.image} />
                        <div className="pt-4">
                            <Button className="w-full" type="submit" disabled={isSaving} isLoading={isSaving}>Update Club</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Activities Management Modal */}
            {selectedClub && (
                <ClubActivitiesModal
                    isOpen={isActivityModalOpen}
                    onClose={() => {
                        setIsActivityModalOpen(false);
                        setSelectedClub(null);
                    }}
                    club={clubs.find(c => c.id === selectedClub.id) || selectedClub}
                    onAdd={scheduleActivity}
                    onUpdate={updateActivity}
                    onDelete={deleteActivity}
                />
            )}

            {/* Members Modal */}
            {selectedClub && (
                <ClubMembersModal
                    isOpen={isMembersModalOpen}
                    onClose={() => { setIsMembersModalOpen(false); setSelectedClub(null); }}
                    club={selectedClub}
                    members={members}
                    getClubMembers={getClubMembers}
                    onRemoveMember={async (memberId: string) => {
                        if (!selectedClub) return;
                        try {
                            await leaveClub(selectedClub.id);
                            showToast('Member removed successfully', 'success');
                        } catch (err) {
                            // Error handled by hook
                        }
                    }}
                />
            )}
            <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </div>
    );
};

// Club Activities Tab Component
interface ClubActivitiesTabProps {
    clubs: HobbyClub[];
    canManage: (club: HobbyClub) => boolean;
    onManage: (club: HobbyClub) => void;
}

const formatActivityDate = (date: string) => date ? date.replace('T', ' · ') : '';

const ClubActivitiesTab: React.FC<ClubActivitiesTabProps> = ({ clubs, canManage, onManage }) => {
    // Flatten all activities across clubs, sorted by date ascending
    const allActivities = clubs
        .flatMap(club => (club.activities || []).map(activity => ({ club, activity })))
        .sort((a, b) => a.activity.date.localeCompare(b.activity.date));
    const now = new Date();
    const upcoming = allActivities.filter(x => new Date(x.activity.date) >= now);
    const past = allActivities.filter(x => new Date(x.activity.date) < now);
    const withoutActivity = clubs.filter(c => !(c.activities || []).length);

    return (
        <div className="space-y-4">
            <LoadingState loading={false} error={null} empty={clubs.length === 0} emptyMessage="No clubs available">
                <div className="space-y-5">
                    {/* Upcoming */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Upcoming Activities</p>
                        {upcoming.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-xl">
                                <Calendar size={28} className="text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">No upcoming club activities</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 bg-white rounded-xl border border-slate-100">
                                {upcoming.map(({ club, activity }) => (
                                    <div key={activity.id} className="flex items-center gap-3 p-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                            <img src={club.image} alt="" className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-900 text-sm truncate">{club.name}</p>
                                                <Badge variant="info">{club.category}</Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                <Calendar size={11} className="text-jci-blue shrink-0" />
                                                <span className="font-semibold text-slate-700 shrink-0">{formatActivityDate(activity.date)}</span>
                                                <span className="truncate">— {activity.description}</span>
                                            </p>
                                        </div>
                                        {canManage(club) && (
                                            <Button variant="outline" size="sm" onClick={() => onManage(club)}>
                                                <Edit size={13} />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Past */}
                    {past.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Past Activities</p>
                            <div className="divide-y divide-slate-50 bg-white rounded-xl border border-slate-100 opacity-70">
                                {past.map(({ club, activity }) => (
                                    <div key={activity.id} className="flex items-center gap-3 p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <span className="font-bold text-slate-600 shrink-0">{club.name}</span>
                                                <span className="shrink-0">· {formatActivityDate(activity.date)}</span>
                                                <span className="truncate">— {activity.description}</span>
                                            </p>
                                        </div>
                                        {canManage(club) && (
                                            <Button variant="outline" size="sm" onClick={() => onManage(club)}>
                                                <Edit size={13} />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No activity scheduled */}
                    {withoutActivity.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">No Activity Scheduled</p>
                            <div className="flex flex-wrap gap-2">
                                {withoutActivity.map(club => (
                                    <button
                                        key={club.id}
                                        disabled={!canManage(club)}
                                        onClick={() => onManage(club)}
                                        className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 enabled:hover:border-jci-blue/30 enabled:hover:text-jci-blue transition-colors disabled:cursor-default"
                                    >
                                        {club.name}
                                        {canManage(club) && <Plus size={11} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </LoadingState>
        </div>
    );
};

// Club Activities Management Modal (CRUD)
interface ClubActivitiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    club: HobbyClub;
    onAdd: (clubId: string, date: string, description: string) => Promise<void>;
    onUpdate: (clubId: string, activityId: string, updates: { date?: string; description?: string }) => Promise<void>;
    onDelete: (clubId: string, activityId: string) => Promise<void>;
}

const ClubActivitiesModal: React.FC<ClubActivitiesModalProps> = ({ isOpen, onClose, club, onAdd, onUpdate, onDelete }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const [editing, setEditing] = useState<ClubActivity | null>(null);
    const [saving, setSaving] = useState(false);
    const activities = [...(club.activities || [])].sort((a, b) => a.date.localeCompare(b.date));

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const date = formData.get('activityDate') as string;
        const description = formData.get('activityDescription') as string;
        setSaving(true);
        try {
            if (editing) {
                await onUpdate(club.id, editing.id, { date, description });
                setEditing(null);
            } else {
                await onAdd(club.id, date, description);
            }
            form.reset();
        } catch {
            // Error handled by hook
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Activities - ${club.name}`} size="lg" drawerOnMobile>
            <div className="space-y-5">
                {/* Existing activities */}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Scheduled Activities</p>
                    {activities.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-xl">
                            <Calendar size={24} className="text-slate-300 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">No activities yet — add one below</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50 bg-white rounded-xl border border-slate-100 max-h-56 overflow-y-auto">
                            {activities.map(activity => {
                                const isPast = new Date(activity.date) < new Date();
                                return (
                                    <div key={activity.id} className={`flex items-center gap-3 p-3 ${editing?.id === activity.id ? 'bg-blue-50/50' : ''} ${isPast ? 'opacity-60' : ''}`}>
                                        <Calendar size={14} className={isPast ? 'text-slate-300 shrink-0' : 'text-jci-blue shrink-0'} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800">{formatActivityDate(activity.date)}{isPast && <span className="ml-2 text-[9px] font-black uppercase text-slate-400">Past</span>}</p>
                                            <p className="text-xs text-slate-500 truncate">{activity.description}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-blue-50 transition-colors"
                                                onClick={() => setEditing(activity)}
                                            >
                                                <Edit size={13} />
                                            </button>
                                            <button
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                onClick={() => setConfirmState({ open: true, title: 'Delete Activity', message: 'Delete this activity?', variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); if (editing?.id === activity.id) setEditing(null); await onDelete(club.id, activity.id); } })}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Add / Edit form */}
                <form key={editing?.id || 'new'} onSubmit={handleSubmit} className="space-y-3 bg-slate-50/70 rounded-xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {editing ? 'Edit Activity' : 'Add New Activity'}
                    </p>
                    <Input name="activityDate" label="Activity Date" type="datetime-local" defaultValue={editing?.date} required />
                    <Textarea name="activityDescription" label="Description" placeholder="Activity description..." defaultValue={editing?.description} required />
                    <div className="flex gap-2 pt-1">
                        {editing && (
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(null)}>
                                Cancel
                            </Button>
                        )}
                        <Button className="flex-1" type="submit" disabled={saving}>
                            {editing ? 'Update Activity' : 'Add Activity'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
        <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </>
    );
};

// Club Members Modal Component
interface ClubMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    club: HobbyClub;
    members: any[];
    getClubMembers: (clubId: string) => Promise<string[]>;
    onRemoveMember: (memberId: string) => Promise<void>;
}

const ClubMembersModal: React.FC<ClubMembersModalProps> = ({ isOpen, onClose, club, members, getClubMembers, onRemoveMember }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const [clubMemberIds, setClubMemberIds] = useState<string[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const { showToast } = useToast();
    const { member: currentMember } = useAuth();

    useEffect(() => {
        if (isOpen && club.id) {
            loadMembers();
        }
    }, [isOpen, club.id]);

    const loadMembers = async () => {
        if (!club.id) return;
        setLoadingMembers(true);
        try {
            const memberIds = await getClubMembers(club.id);
            setClubMemberIds(memberIds);
        } catch (err) {
            showToast('Failed to load club members', 'error');
        } finally {
            setLoadingMembers(false);
        }
    };

    const clubMembers = members.filter(m => clubMemberIds.includes(m.id));
    const isOwner = currentMember && club.lead === currentMember.name;

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Members - ${club.name}`} size="lg" drawerOnMobile>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">Total Members: {club.membersCount || 0}</p>
                    {isOwner && (
                        <Badge variant="info">Club Leader</Badge>
                    )}
                </div>

                <LoadingState loading={loadingMembers} error={null} empty={clubMembers.length === 0} emptyMessage="No members found">
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {clubMembers.map(member => (
                            <Card key={member.id} className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-jci-blue text-white flex items-center justify-center font-semibold">
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{member.name}</p>
                                            <p className="text-xs text-slate-500">{member.email}</p>
                                        </div>
                                    </div>
                                    {isOwner && member.id !== currentMember?.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setConfirmState({ open: true, title: 'Remove Member', message: `Remove ${member.name} from ${club.name}?`, variant: 'warning', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); try { await onRemoveMember(member.id); await loadMembers(); } catch (err) { /* Error handled */ } } })}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </LoadingState>
            </div>
        </Modal>
        <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
        </>
    );
};