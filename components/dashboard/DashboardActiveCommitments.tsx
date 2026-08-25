import React from 'react';
import { Clock, Flame, Target } from 'lucide-react';
import type { CommitmentContract } from '../../services/contractService';
import { Card } from '../ui/Common';

interface DashboardActiveCommitmentsProps {
  contracts: CommitmentContract[];
}

const formatDeadline = (deadline: CommitmentContract['deadline']) => {
  if (!deadline) return 'N/A';
  return typeof (deadline as any).seconds === 'number'
    ? new Date((deadline as any).seconds * 1000).toLocaleDateString()
    : new Date(deadline as unknown as Date).toLocaleDateString();
};

export const DashboardActiveCommitments: React.FC<DashboardActiveCommitmentsProps> = ({ contracts }) => {
  const activeContracts = contracts.filter(contract => contract.status === 'Active');
  if (activeContracts.length === 0) return null;

  return (
    <Card className="bg-slate-50 border-2 border-slate-200 hover:bg-white transition-all group overflow-hidden">
      <div className="flex items-center justify-between p-1 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
            <Flame size={18} className="animate-bounce" />
          </div>
          <h3 className="font-extrabold text-slate-900 uppercase tracking-tight">Active Commitments</h3>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Your Active Bets</p>
        {activeContracts.map(contract => (
          <div key={contract.id} className="p-4 bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_rgba(15,23,42,0.1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-xs font-black text-slate-900 uppercase italic">Goal: {contract.goalTitle}</h4>
              <div className="flex items-center gap-1 text-red-600 font-black">
                -{contract.stakedPoints} <Target size={12} className="fill-red-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <Clock size={12} />
              Ends: {formatDeadline(contract.deadline)}
            </div>
            <div className="mt-3 text-[10px] p-2 bg-red-50 text-red-700 rounded-lg border border-red-100 font-bold italic">
              WARNING: Failure to prove completion will results in permanent loss of {contract.stakedPoints} PTS.
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
