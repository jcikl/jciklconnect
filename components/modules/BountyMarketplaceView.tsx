import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Shield, Coins, Zap, Target, MessageSquare, AlertTriangle, 
  CheckCircle, ShieldCheck
} from 'lucide-react';
import {
  Card, Button, Badge, useToast, Modal, Tabs
} from '../ui/Common';
import { Input, Textarea, Select } from '../ui/Form';
import { BountyService, Bounty } from '../../services/bountyService';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import { formatDateToDDMMMYYYY } from '../../utils/dateUtils';
import { LoadingState } from '../ui/Loading';

export const BountyMarketplaceView: React.FC = () => {
  const { member } = useAuth();
  const { showToast } = useToast();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [myQuests, setMyQuests] = useState<Bounty[]>([]);
  const [myPosts, setMyPosts] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'marketplace' | 'quests' | 'posts'>('marketplace');
  const [filter, setFilter] = useState<'All' | 'BUSINESS' | 'COMMUNITY' | 'INDIVIDUAL'>('All');
  
  // Modals
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);

  const loadData = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    try {
      const [openData, questData, postData] = await Promise.all([
        BountyService.getOpenBounties(),
        BountyService.getUserClaimedBounties(member.id),
        BountyService.getUserPostedBounties(member.id)
      ]);
      setBounties(openData);
      setMyQuests(questData);
      setMyPosts(postData);
    } catch (err) {
      showToast('Failed to sync competition floor', 'error');
    } finally {
      setLoading(false);
    }
  }, [member, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePostBounty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) return;

    const formData = new FormData(e.currentTarget);
    const rewardPoints = parseInt(formData.get('rewardPoints') as string);

    if (member.points < rewardPoints) {
      showToast('Insufficient points to lock in escrow', 'error');
      return;
    }

    setActioning(true);
    try {
      const bountyData: any = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        rewardPoints,
        category: formData.get('category') as any,
        urgency: formData.get('urgency') as any,
        tags: (formData.get('tags') as string).split(',').map(t => t.trim()),
      };

      await BountyService.postBounty(member.id, member.name, bountyData);
      showToast('Bounty committed to floor. Points escrowed.', 'success');
      setIsPostModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Failed to post bounty', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleClaim = async (bountyId: string) => {
    if (!member) return;
    setActioning(true);
    try {
      await BountyService.claimBounty(bountyId, member.id, member.name);
      showToast('Bounty claimed. Happy hunting!', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Claim failed', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBounty) return;

    const formData = new FormData(e.currentTarget);
    const proofText = formData.get('proofText') as string;

    setActioning(true);
    try {
      await BountyService.submitBountyProof(selectedBounty.id!, proofText, []);
      showToast('Proof submitted for review.', 'success');
      setIsSubmitModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Failed to submit proof', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleApprove = async (bountyId: string) => {
    if (!member) return;
    setActioning(true);
    try {
      await BountyService.finalizeBounty(bountyId);
      showToast('Bounty approved. Points released!', 'success');
      setIsReviewModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Failed to release escrow', 'error');
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBounty) return;

    const formData = new FormData(e.currentTarget);
    const reason = formData.get('reason') as string;

    setActioning(true);
    try {
      await BountyService.rejectBountySubmission(selectedBounty.id!, reason);
      showToast('Submission rejected.', 'warning');
      setIsReviewModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Failed to reject', 'error');
    } finally {
      setActioning(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-blue-500';
      default: return 'bg-slate-400';
    }
  };

  const filteredBounties = bounties.filter(b => filter === 'All' || b.category === filter);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Marketplace Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            Bounty Marketplace
            <Badge className="bg-orange-500 text-green border-none animate-pulse px-3 py-1">LIVE</Badge>
          </h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Resource Competition Floor • Total Escrow: <span className="text-jci-blue">{(bounties.reduce((a, b) => a + b.rewardPoints, 0)).toLocaleString()} PTS</span></p>
        </div>
        <Button
          size="lg"
          onClick={() => setIsPostModalOpen(true)}
          className="bg-slate-900 border-b-4 border-slate-700 active:border-b-0 active:translate-y-1 transition-all rounded-2xl px-8 shadow-xl shadow-slate-200"
        >
          <Plus size={20} className="mr-2" /> Post Bounty
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'marketplace', label: 'Bounty Floor' },
          { id: 'quests', label: 'My Quests' },
          { id: 'posts', label: 'My Posts' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === t.id ? 'bg-white shadow-md text-jci-blue' : 'text-slate-500 hover:bg-white/50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState loading={true}><div>Syncing Competition Floor...</div></LoadingState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {activeTab === 'marketplace' && (
            filteredBounties.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Target className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 font-bold uppercase tracking-tighter">No resource demands currently on the floor.</p>
              </div>
            ) : (
              filteredBounties.map((bounty) => (
                <BountyCard 
                  key={bounty.id} 
                  bounty={bounty} 
                  isOwner={member?.id === bounty.posterId}
                  onClaim={() => handleClaim(bounty.id!)}
                  getUrgencyColor={getUrgencyColor}
                />
              ))
            )
          )}

          {activeTab === 'quests' && (
            myQuests.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Zap className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 font-bold uppercase tracking-tighter">You haven't claimed any bounties yet.</p>
              </div>
            ) : (
              myQuests.map((bounty) => (
                <BountyCard 
                  key={bounty.id} 
                  bounty={bounty} 
                  isQuest={true}
                  onAction={() => {
                    setSelectedBounty(bounty);
                    setIsSubmitModalOpen(true);
                  }}
                  getUrgencyColor={getUrgencyColor}
                />
              ))
            )
          )}

          {activeTab === 'posts' && (
            myPosts.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <ShieldCheck className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 font-bold uppercase tracking-tighter">You haven't posted any demands yet.</p>
              </div>
            ) : (
              myPosts.map((bounty) => (
                <BountyCard 
                  key={bounty.id} 
                  bounty={bounty} 
                  isPosted={true}
                  onAction={() => {
                    setSelectedBounty(bounty);
                    setIsReviewModalOpen(true);
                  }}
                  getUrgencyColor={getUrgencyColor}
                />
              ))
            )
          )}
        </div>
      )}

      {/* Post Bounty Modal */}
      <Modal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        title="Post Resource Demand"
        size="lg"
      >
        <form onSubmit={handlePostBounty} className="space-y-6">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
            <Shield className="text-amber-600 shrink-0" size={24} />
            <p className="text-xs font-bold text-amber-700">
              Posting a bounty will lock points in escrow. Points are released only upon approval.
            </p>
          </div>

          <div className="space-y-4">
            <Input name="title" label="Title" placeholder="e.g. Regional HQ Referral" required />
            <Textarea name="description" label="Requirements" placeholder="Describe deliverables..." rows={4} required />

            <div className="grid grid-cols-2 gap-4">
              <Select name="category" label="Category" options={[
                { label: 'Business', value: 'BUSINESS' },
                { label: 'Community', value: 'COMMUNITY' },
                { label: 'Individual', value: 'INDIVIDUAL' }
              ]} />
              <Select name="urgency" label="Urgency" options={[
                { label: 'Low', value: 'Low' },
                { label: 'Medium', value: 'Medium' },
                { label: 'High', value: 'High' },
                { label: 'Critical', value: 'Critical' }
              ]} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input name="rewardPoints" label="Points" type="number" defaultValue="500" required />
              <Input name="tags" label="Tags" placeholder="referral, tech" />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setIsPostModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={actioning} className="bg-slate-900 px-8 font-black uppercase italic">
                Commit & Post
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Submit Proof Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit Bounty Proof"
        size="lg"
      >
        {selectedBounty && (
          <form onSubmit={handleSubmitProof} className="space-y-6">
            <Textarea 
              name="proofText" 
              label="Evidence / Deliverables" 
              placeholder="Detail how you fulfilled the demand..." 
              rows={6} 
              required 
            />
            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setIsSubmitModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={actioning} className="bg-jci-blue px-8 font-black uppercase italic">
                Submit for Review
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review Submission"
        size="lg"
      >
        {selectedBounty && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
              {selectedBounty.claimantProofText || "No proof provided."}
            </div>

            {selectedBounty.status === 'Submitted' && (
              <div className="pt-6 flex flex-col gap-4">
                <Button 
                  variant="success" 
                  className="w-full font-black uppercase italic py-4"
                  onClick={() => handleApprove(selectedBounty.id!)}
                  isLoading={actioning}
                >
                  Release Points
                </Button>
                
                <form onSubmit={handleReject} className="pt-4 border-t border-slate-100 flex gap-2">
                  <Input name="reason" placeholder="Rejection reason..." required className="flex-1" />
                  <Button variant="outline" type="submit" isLoading={actioning} className="text-red-500">
                    Reject
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

// Helper Components
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variant = 
    status === 'Open' ? 'jci' : 
    status === 'Claimed' ? 'warning' : 
    status === 'Submitted' ? 'info' : 
    status === 'Completed' ? 'success' : 'neutral';
  
  return <Badge variant={variant} className="rounded-full px-3 uppercase text-[10px] font-black italic">{status}</Badge>;
};

const BountyCard: React.FC<{ 
  bounty: Bounty; 
  isOwner?: boolean; 
  isQuest?: boolean; 
  isPosted?: boolean;
  onClaim?: () => void;
  onAction?: () => void;
  getUrgencyColor: (urgency: string) => string;
}> = ({ bounty, isOwner, isQuest, isPosted, onClaim, onAction, getUrgencyColor }) => {
  const status = bounty.status;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card noPadding className="relative h-full border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-jci-blue/10 transition-all rounded-[2.5rem] overflow-hidden group bg-white">
        <div className={`absolute top-0 left-0 w-2 h-full ${getUrgencyColor(bounty.urgency)}`}></div>
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <Badge variant="jci" className="rounded-full px-4 py-1 font-black italic">{bounty.category}</Badge>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 leading-none">{bounty.rewardPoints}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PTS</div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-black text-slate-900 uppercase italic flex-1 truncate">{bounty.title}</h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-slate-500 line-clamp-3 font-medium">{bounty.description}</p>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-50">
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {isQuest ? `Posted by: ${bounty.posterName}` : (isPosted ? `Claimed by: ${bounty.claimantName || 'Pending'}` : bounty.posterName)}
            </div>
            {status === 'Open' && !isOwner && (
              <Button onClick={onClaim} size="sm" className="rounded-full px-6 bg-jci-navy">Hunt</Button>
            )}
            {isQuest && status === 'Claimed' && (
              <Button onClick={onAction} size="sm" className="rounded-full px-6 bg-orange-500">Submit</Button>
            )}
            {isPosted && status === 'Submitted' && (
              <Button onClick={onAction} size="sm" className="rounded-full px-6 bg-slate-900">Review</Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
