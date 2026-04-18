import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, Shield, Coins, Zap, Clock, Users, ArrowUpRight,
  CheckCircle, Flame, Target, MessageSquare, AlertTriangle, ChevronRight,
  TrendingUp, Award, Briefcase, Globe
} from 'lucide-react';
import {
  Card, Button, Badge, useToast, Modal
} from '../ui/Common';
import { Input, Textarea, Select } from '../ui/Form';
import { BountyService, Bounty } from '../../services/bountyService';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateToDDMMMYYYY } from '../../utils/dateUtils';
import { BOUNTY_STATUS } from '../../config/constants';

export const BountyMarketplaceView: React.FC = () => {
  const { member } = useAuth();
  const { showToast } = useToast();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [filter, setFilter] = useState<'All' | 'BUSINESS' | 'COMMUNITY' | 'INDIVIDUAL'>('All');

  // Load Bounties
  const loadBounties = async () => {
    setLoading(true);
    try {
      const data = await BountyService.getOpenBounties();
      setBounties(data);
    } catch (err) {
      showToast('Failed to load marketplace', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBounties();
  }, []);

  const handlePostBounty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) return;

    const formData = new FormData(e.currentTarget);
    const rewardPoints = parseInt(formData.get('rewardPoints') as string);

    if (member.points < rewardPoints) {
      showToast('Insufficient points to post this bounty', 'error');
      return;
    }

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
      showToast('Bounty posted! Points locked in escrow.', 'success');
      setIsPostModalOpen(false);
      loadBounties();
    } catch (err) {
      showToast('Failed to post bounty', 'error');
    }
  };

  const handleClaim = async (bountyId: string) => {
    if (!member) return;
    try {
      await BountyService.claimBounty(bountyId, member.id, member.name);
      showToast('Bounty claimed! Get to work, hunter.', 'success');
      loadBounties();
    } catch (err: any) {
      showToast(err.message || 'Claim failed', 'error');
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

      {/* Hunter Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-jci-blue text-white border-none shadow-lg">
          <p className="text-[10px] font-black uppercase opacity-60">Active Bounties</p>
          <p className="text-3xl font-black">{bounties.length}</p>
        </Card>
        <Card className="bg-slate-900 text-white border-none shadow-lg">
          <p className="text-[10px] font-black uppercase opacity-60">Avg. Payout</p>
          <p className="text-3xl font-black">
            {bounties.length > 0 ? Math.round(bounties.reduce((a, b) => a + b.rewardPoints, 0) / bounties.length) : 0}
          </p>
        </Card>
        <Card className="bg-white border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a]">
          <p className="text-[10px] font-black uppercase text-slate-400">Your Success</p>
          <p className="text-3xl font-black text-slate-900">0%</p>
        </Card>
        <Card className="bg-white border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a]">
          <p className="text-[10px] font-black uppercase text-slate-400">Total Profits</p>
          <p className="text-3xl font-black text-emerald-600">0</p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {['All', 'BUSINESS', 'COMMUNITY', 'INDIVIDUAL'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${filter === f ? 'bg-white shadow-md text-jci-blue' : 'text-slate-500 hover:bg-white/50'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bounties Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        {loading ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <Zap className="mx-auto text-jci-blue animate-pulse" size={48} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Syncing Competition Floor...</p>
          </div>
        ) : filteredBounties.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border-4 border-dashed border-slate-200">
            <Target className="mx-auto text-slate-300 mb-4" size={64} />
            <h3 className="text-xl font-black text-slate-900 uppercase">No active bounties</h3>
            <p className="text-slate-500">Wait for a drop or post your own resource demand.</p>
          </div>
        ) : (
          filteredBounties.map(bounty => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={bounty.id}
            >
              <Card className={`relative min-h-[220px] bg-white border-2 hover:border-jci-blue hover:shadow-2xl transition-all cursor-pointer group flex flex-col p-6 rounded-[32px] ${bounty.urgency === 'Critical' ? 'border-red-500' : 'border-slate-200'}`}>
                {/* Category & Points Badge */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[10px] py-1 px-3">
                      {bounty.category}
                    </Badge>
                    {bounty.urgency === 'Critical' && (
                      <Badge className="bg-red-500 text-white border-none animate-pulse font-black text-[10px] py-1 px-3">
                        URGENT
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-2xl font-black text-jci-blue italic tracking-tighter">
                    {bounty.rewardPoints.toLocaleString()}
                    <Coins size={20} className="text-amber-500" />
                  </div>
                </div>

                {/* Title & Description */}
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight group-hover:text-jci-blue transition-colors">{bounty.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-4 font-medium leading-relaxed">
                    {bounty.description}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(bounty.posterName)}&background=f1f5f9&color=64748b`}
                      className="w-8 h-8 rounded-full border border-white shadow-sm"
                      alt=""
                    />
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Posted by</p>
                      <p className="text-xs font-bold text-slate-700">{bounty.posterName}</p>
                    </div>
                  </div>

                  {member?.id === bounty.posterId ? (
                    <Badge variant="neutral" className="opacity-50">YOUR BOUNTY</Badge>
                  ) : (
                    <Button
                      onClick={() => handleClaim(bounty.id!)}
                      className="rounded-full px-6 font-black uppercase text-xs tracking-widest bg-jci-navy hover:bg-jci-blue"
                    >
                      Hunt Now
                    </Button>
                  )}
                </div>

                {/* Decorative Overlays */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-jci-blue/5 transition-colors -z-10"></div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

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
              Posting a bounty will lock the reward points in escrow immediately. Points will only be released once you approve the hunter's submission.
            </p>
          </div>

          <div className="space-y-4">
            <Input name="title" label="What do you need?" placeholder="e.g. Regional HQ Referral for Logistics Tech" required />
            <Textarea name="description" label="Detailed Demand (Deliverables)" placeholder="Specify exactly what you need to receive to release the points." rows={4} required />

            <div className="grid grid-cols-2 gap-4">
              <Select
                name="category"
                label="Category"
                options={[
                  { label: 'Business', value: 'BUSINESS' },
                  { label: 'Community', value: 'COMMUNITY' },
                  { label: 'Individual', value: 'INDIVIDUAL' },
                  { label: 'International', value: 'INTERNATIONAL' }
                ]}
              />
              <Select
                name="urgency"
                label="Urgency"
                options={[
                  { label: 'Low', value: 'Low' },
                  { label: 'Medium', value: 'Medium' },
                  { label: 'High', value: 'High' },
                  { label: 'Critical (High Impact)', value: 'Critical' }
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input name="rewardPoints" label="Reward Points" type="number" defaultValue="500" required />
              <Input name="tags" label="Tags (comma separated)" placeholder="referral, tech, region" />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setIsPostModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 px-8 font-black uppercase italic">
                Commit & Post
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
