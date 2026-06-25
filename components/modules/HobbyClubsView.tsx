import React, { useState, useEffect } from 'react';
import { Users, Calendar, Plus, Heart, Edit, Trash2 } from 'lucide-react';
import { Card, Button, AvatarGroup, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useHobbyClubs } from '../../hooks/useHobbyClubs';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { HobbyClub } from '../../types';
import { Tabs } from '../ui/Common';

export const HobbyClubsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedClub, setSelectedClub] = useState<HobbyClub | null>(null);
    const [activeTab, setActiveTab] = useState<'clubs' | 'activities'>('clubs');
    const { clubs, loading, error, createClub, updateClub, deleteClub, joinClub, leaveClub, scheduleActivity, getClubMembers } = useHobbyClubs();
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
                image: formData.get('image') as string || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.get('name') as string)}&background=0097D7&color=fff&size=200`,
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
        }
    };

    const handleDeleteClub = async (clubId: string) => {
        if (window.confirm('Are you sure you want to delete this club?')) {
            try {
                await deleteClub(clubId);
            } catch (err) {
                // Error is handled in the hook
            }
        }
    };

    const isOwner = (club: HobbyClub) => {
        return member && club.lead === member.name;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Hobby Clubs</h2>
                    <p className="text-slate-500">Connect with members beyond formal projects.</p>
                </div>
                <Button onClick={() => setCreateModalOpen(true)}><Plus size={16} className="mr-2" /> Start New Club</Button>
            </div>

            <Card noPadding>
                <div className="px-4 md:px-6 pt-4">
                    <Tabs
                        tabs={['Clubs', 'Activities']}
                        activeTab={activeTab === 'clubs' ? 'Clubs' : 'Activities'}
                        onTabChange={(tab) => setActiveTab(tab === 'Clubs' ? 'clubs' : 'activities')}
                    />
                </div>
                <div className="p-4">
                    {activeTab === 'clubs' ? (
                        <LoadingState loading={loading} error={error} empty={filteredClubs.length === 0} emptyMessage="No hobby clubs found">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredClubs.map(club => (
                                    <Card key={club.id} noPadding className="hover:shadow-lg transition-shadow">
                                        <div className="h-32 bg-slate-200 relative">
                                            <img src={club.image} alt={club.name} className="w-full h-full object-cover" />
                                            <div className="absolute top-4 right-4">
                                                <Badge variant="neutral">{club.category}</Badge>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-lg font-bold text-slate-900">{club.name}</h3>
                                                {isOwner(club) && (
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedClub(club);
                                                                setEditModalOpen(true);
                                                            }}
                                                        >
                                                            <Edit size={14} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteClub(club.id)}
                                                        >
                                                            <Trash2 size={14} className="text-red-600" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between mb-4">
                                                <div className="text-sm text-slate-500">
                                                    <span className="block text-xs uppercase tracking-wide">Members</span>
                                                    <div className="mt-1">
                                                        <AvatarGroup count={club.membersCount} />
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm text-slate-500">
                                                    <span className="block text-xs uppercase tracking-wide">Lead</span>
                                                    <span className="font-medium text-slate-800">{club.lead}</span>
                                                </div>
                                            </div>

                                            {club.nextActivity && (
                                                <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3 mb-4">
                                                    <Calendar size={16} className="text-jci-blue mt-0.5" />
                                                    <div>
                                                        <span className="block text-xs text-blue-600 font-bold uppercase">Next Activity</span>
                                                        <span className="text-sm font-medium text-slate-900">{club.nextActivity}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                {isOwner(club) ? (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1"
                                                            onClick={() => {
                                                                setSelectedClub(club);
                                                                setIsMembersModalOpen(true);
                                                            }}
                                                        >
                                                            <Users size={14} className="mr-2" />
                                                            Members
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedClub(club);
                                                                setIsActivityModalOpen(true);
                                                            }}
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
                                                            Join Club
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedClub(club);
                                                                setIsMembersModalOpen(true);
                                                            }}
                                                        >
                                                            <Users size={14} />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </LoadingState>
                    ) : (
                        <ClubActivitiesTab clubs={filteredClubs} />
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
                            <Button className="w-full" type="submit">Update Club</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Activity Modal */}
            {selectedClub && (
                <Modal
                    isOpen={isActivityModalOpen}
                    onClose={() => {
                        setIsActivityModalOpen(false);
                        setSelectedClub(null);
                    }}
                    title="Schedule Activity"
                    size="lg"
                    drawerOnMobile
                >
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!selectedClub) return;
                        const formData = new FormData(e.currentTarget);
                        const activityDate = formData.get('activityDate') as string;
                        const activityDescription = formData.get('activityDescription') as string;
                        try {
                            await scheduleActivity(selectedClub.id, activityDate, activityDescription);
                            setIsActivityModalOpen(false);
                            setSelectedClub(null);
                        } catch (err) {
                            // Error handled by hook
                        }
                    }} className="space-y-4">
                        <Input name="activityDate" label="Activity Date" type="datetime-local" required />
                        <Textarea name="activityDescription" label="Description" placeholder="Activity description..." required />
                        <div className="pt-4">
                            <Button className="w-full" type="submit">Schedule Activity</Button>
                        </div>
                    </form>
                </Modal>
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
        </div>
    );
};

// Club Activities Tab Component
interface ClubActivitiesTabProps {
    clubs: HobbyClub[];
}

const ClubActivitiesTab: React.FC<ClubActivitiesTabProps> = ({ clubs }) => {
    const { showToast } = useToast();

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Club Activities</h3>
            <LoadingState loading={false} error={null} empty={clubs.length === 0} emptyMessage="No clubs available">
                <div className="space-y-3">
                    {clubs.map(club => (
                        <Card key={club.id} className="hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900">{club.name}</h4>
                                    {club.nextActivity && (
                                        <p className="text-sm text-slate-600 mt-1">
                                            <Calendar size={14} className="inline mr-1" />
                                            Next: {club.nextActivity}
                                        </p>
                                    )}
                                </div>
                                <Badge variant="info">{club.category}</Badge>
                            </div>
                        </Card>
                    ))}
                </div>
            </LoadingState>
        </div>
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
                                            onClick={async () => {
                                                if (window.confirm(`Remove ${member.name} from ${club.name}?`)) {
                                                    try {
                                                        await onRemoveMember(member.id);
                                                        await loadMembers();
                                                    } catch (err) {
                                                        // Error handled
                                                    }
                                                }
                                            }}
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
    );
};