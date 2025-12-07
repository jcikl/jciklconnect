import React, { useState } from 'react';
import { Users, Calendar, Plus, Heart } from 'lucide-react';
import { Card, Button, AvatarGroup, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MOCK_CLUBS } from '../../services/mockData';
import { HobbyClub } from '../../types';

export const HobbyClubsView: React.FC = () => {
    const [clubs, setClubs] = useState<HobbyClub[]>(MOCK_CLUBS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { showToast } = useToast();

    const handleCreateClub = (e: React.FormEvent) => {
        e.preventDefault();
        const newClub: HobbyClub = {
            id: `hc${Date.now()}`,
            name: 'New Interest Group',
            category: 'Social',
            membersCount: 1,
            lead: 'Current User',
            image: 'https://placehold.co/200/blue/white?text=New'
        };
        setClubs([...clubs, newClub]);
        setIsModalOpen(false);
        showToast('New club created! Invite members now.', 'success');
    }

    const handleJoin = (id: string) => {
        setClubs(clubs.map(c => c.id === id ? {...c, membersCount: c.membersCount + 1} : c));
        showToast('Joined club successfully', 'success');
    }

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Hobby Clubs</h2>
                    <p className="text-slate-500">Connect with members beyond formal projects.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}><Plus size={16} className="mr-2"/> Start New Club</Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clubs.map(club => (
                    <Card key={club.id} noPadding className="hover:shadow-lg transition-shadow">
                        <div className="h-32 bg-slate-200 relative">
                            <img src={club.image} alt={club.name} className="w-full h-full object-cover" />
                            <div className="absolute top-4 right-4">
                                <Badge variant="neutral">{club.category}</Badge>
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{club.name}</h3>
                            
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

                            <Button className="w-full" onClick={() => handleJoin(club.id)}>Join Club</Button>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Start New Hobby Club">
                <form onSubmit={handleCreateClub} className="space-y-4">
                    <Input label="Club Name" placeholder="e.g. Chess Club" required />
                    <Select label="Category" options={[
                        {label: 'Sports', value: 'Sports'},
                        {label: 'Social', value: 'Social'},
                        {label: 'Professional', value: 'Professional'},
                        {label: 'Arts', value: 'Arts'}
                    ]} />
                    <Input label="Description" placeholder="What will you do?" />
                    <div className="pt-4">
                        <Button className="w-full" type="submit">Create Club</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};