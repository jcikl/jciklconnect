import React, { useState } from 'react';
import { Vote, FileText, CheckCircle, Clock, Award, Plus } from 'lucide-react';
import { Card, Button, Badge, Tabs, ProgressBar, Modal, useToast } from '../ui/Common';
import { Input } from '../ui/Form';
import { MOCK_ELECTIONS, MOCK_PROPOSALS } from '../../services/mockData';
import { Proposal } from '../../types';

export const GovernanceView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('Elections');
    const [isProposalModalOpen, setProposalModalOpen] = useState(false);
    const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS);
    const { showToast } = useToast();

    const handleSubmitProposal = (e: React.FormEvent) => {
        e.preventDefault();
        const newProposal: Proposal = {
            id: `pr${Date.now()}`,
            title: 'New Policy Initiative',
            description: 'Proposal content placeholder...',
            submittedBy: 'Current User',
            status: 'Draft',
            votes: { for: 0, against: 0, abstain: 0 }
        };
        setProposals([...proposals, newProposal]);
        setProposalModalOpen(false);
        showToast('Proposal submitted to Secretary for review', 'success');
    }

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Governance & Voting</h2>
                    <p className="text-slate-500">Secure electronic voting and policy management.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><FileText size={16} className="mr-2"/> View Bylaws</Button>
                    <Button onClick={() => setProposalModalOpen(true)}><Plus size={16} className="mr-2"/> Submit Proposal</Button>
                </div>
            </div>

            <Card noPadding>
                <div className="px-6">
                    <Tabs tabs={['Elections', 'Policy Proposals', 'Past Results']} activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
                <div className="p-6 bg-slate-50/50 min-h-[400px]">
                    {activeTab === 'Elections' && <ElectionsList />}
                    {activeTab === 'Policy Proposals' && <ProposalsList proposals={proposals} />}
                    {activeTab === 'Past Results' && <div className="text-center text-slate-400 py-10">Archive is empty.</div>}
                </div>
            </Card>

            <Modal isOpen={isProposalModalOpen} onClose={() => setProposalModalOpen(false)} title="Submit Policy Proposal">
                <form onSubmit={handleSubmitProposal} className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-4">
                        Proposals must be seconded by another member before being added to the agenda.
                    </div>
                    <Input label="Title" placeholder="e.g. Constitutional Amendment Article 4" required />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Text</label>
                        <textarea className="w-full border-slate-300 rounded-lg shadow-sm focus:border-jci-blue focus:ring-jci-blue sm:text-sm p-3 border h-32" placeholder="Describe the motion..." required></textarea>
                    </div>
                    <Input label="Seconder Name" placeholder="Who supports this?" />
                    <div className="pt-4">
                        <Button className="w-full" type="submit">Submit Motion</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

const ElectionsList: React.FC = () => {
    // Local state to simulate voting interaction
    const [votedElections, setVotedElections] = useState<Record<string, boolean>>({});
    const { showToast } = useToast();

    const handleVote = (electionId: string) => {
        setVotedElections(prev => ({...prev, [electionId]: true}));
        showToast('Vote cast securely', 'success');
    };

    return (
        <div className="space-y-6">
            {MOCK_ELECTIONS.map(election => {
                const hasVoted = votedElections[election.id];

                return (
                    <div key={election.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={election.status === 'Active' ? 'success' : 'info'}>{election.status}</Badge>
                                    <span className="text-xs text-slate-500">Ends {new Date(election.endDate).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">{election.title}</h3>
                            </div>
                            {election.status === 'Active' && !hasVoted && (
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                                    <Vote size={16} /> Voting Open
                                </div>
                            )}
                            {hasVoted && (
                                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm font-medium">
                                    <CheckCircle size={16} /> Ballot Submitted
                                </div>
                            )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {election.candidates.map(candidate => (
                                <div key={candidate.id} className={`border rounded-lg p-4 flex flex-col items-center text-center transition-all group relative bg-slate-50/30 ${hasVoted ? 'opacity-70 grayscale' : 'hover:border-jci-blue'}`}>
                                    <img src={candidate.avatar} alt={candidate.name} className="w-16 h-16 rounded-full bg-slate-200 mb-3" />
                                    <h4 className="font-bold text-slate-900">{candidate.name}</h4>
                                    <p className="text-sm text-slate-500 mb-4">{candidate.position}</p>
                                    
                                    <Button 
                                        size="sm" 
                                        className="w-full mt-auto" 
                                        disabled={election.status !== 'Active' || hasVoted}
                                        onClick={() => handleVote(election.id)}
                                    >
                                        {hasVoted ? 'Voted' : 'Vote'}
                                    </Button>
                                    
                                    {election.status === 'Active' && !hasVoted && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">Profile</Button>
                                    </div>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    )
}

const ProposalsList: React.FC<{proposals?: Proposal[]}> = ({proposals = MOCK_PROPOSALS}) => {
    // Local state for proposal voting
    const [votedProposals, setVotedProposals] = useState<Record<string, string>>({});
    const { showToast } = useToast();

    const handleVote = (id: string, type: 'for' | 'against' | 'abstain') => {
        setVotedProposals(prev => ({...prev, [id]: type}));
        showToast(`Vote '${type}' recorded`, 'success');
    }

    return (
        <div className="space-y-4">
            {proposals.map(prop => {
                const totalVotes = prop.votes.for + prop.votes.against + prop.votes.abstain;
                const forPercent = totalVotes > 0 ? (prop.votes.for / totalVotes) * 100 : 0;
                const userVote = votedProposals[prop.id];
                
                return (
                    <div key={prop.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm transition-all hover:shadow-md">
                         <div className="flex justify-between items-start mb-2">
                             <div className="flex gap-2">
                                <Badge variant={prop.status === 'Approved' ? 'success' : prop.status === 'Voting' ? 'warning' : 'neutral'}>{prop.status}</Badge>
                                {userVote && <Badge variant="info">You Voted: {userVote}</Badge>}
                             </div>
                             <span className="text-xs text-slate-400">ID: {prop.id}</span>
                         </div>
                         <h3 className="text-lg font-bold text-slate-900 mb-1">{prop.title}</h3>
                         <p className="text-sm text-slate-500 mb-4">Submitted by {prop.submittedBy}</p>
                         <p className="text-slate-700 text-sm mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100 leading-relaxed">{prop.description}</p>

                         <div className="space-y-2 mb-6">
                             <div className="flex justify-between text-xs font-medium text-slate-600">
                                 <span>Community Consensus</span>
                                 <span>{Math.round(forPercent)}% Approval</span>
                             </div>
                             <ProgressBar progress={forPercent} color="bg-green-500" />
                         </div>

                         {(prop.status === 'Voting' || prop.status === 'Draft') && !userVote && (
                             <div className="flex gap-3 pt-4 border-t border-slate-100">
                                 <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1" onClick={() => handleVote(prop.id, 'for')}>Vote For</Button>
                                 <Button size="sm" className="bg-red-600 hover:bg-red-700 flex-1" onClick={() => handleVote(prop.id, 'against')}>Vote Against</Button>
                                 <Button size="sm" variant="outline" className="flex-1" onClick={() => handleVote(prop.id, 'abstain')}>Abstain</Button>
                             </div>
                         )}
                         {userVote && (
                             <div className="text-center text-sm text-slate-400 italic pt-2">
                                 Thank you for participating in this vote.
                             </div>
                         )}
                    </div>
                )
            })}
        </div>
    )
}