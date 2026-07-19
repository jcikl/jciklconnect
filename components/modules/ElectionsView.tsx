import React, { useState, useEffect, useMemo } from 'react';
import { Vote, CheckCircle, Clock, Lock, BarChart2 } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, PageHeader, Tabs } from '../ui/Common';
import { LoadingOverlay } from '../ui/Loading';
import { useElections, Election } from '../../hooks/useElections';
import { formatDate } from '../../utils/dateUtils';

const STATUS_LABELS: Record<Election['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  tallied: 'Results Published',
};

const STATUS_COLORS: Record<Election['status'], 'neutral' | 'success' | 'info' | 'jci'> = {
  draft: 'neutral',
  open: 'success',
  closed: 'info',
  tallied: 'jci',
};

interface VoteModalProps {
  election: Election;
  onClose: () => void;
  onSubmit: (votes: Record<string, string>) => Promise<void>;
}

const VoteModal: React.FC<VoteModalProps> = ({ election, onClose, onSubmit }) => {
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const allVoted = election.positions.every(p => votes[p]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(votes);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Vote — ${election.title}`}>
      <div className="space-y-4">
        {election.positions.map(position => (
          <div key={position}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {position}
            </label>
            <input
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              placeholder="Enter candidate name or ID"
              value={votes[position] ?? ''}
              onChange={e => setVotes(v => ({ ...v, [position]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!allVoted || submitting}>
            {submitting ? 'Submitting…' : 'Submit Ballot'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface ResultsModalProps {
  election: Election;
  onClose: () => void;
}

const ResultsModal: React.FC<ResultsModalProps> = ({ election, onClose }) => {
  const tally = election.tally ?? {};
  return (
    <Modal isOpen onClose={onClose} title={`Results — ${election.title}`}>
      <div className="space-y-4">
        {Object.keys(tally).length === 0 ? (
          <p className="text-sm text-gray-500">No tally data available.</p>
        ) : (
          Object.entries(tally).map(([position, counts]) => {
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const total = sorted.reduce((s, [, c]) => s + c, 0);
            return (
              <div key={position}>
                <h4 className="font-medium text-sm mb-2">{position}</h4>
                <div className="space-y-1">
                  {sorted.map(([candidate, count]) => (
                    <div key={candidate} className="flex items-center gap-2 text-sm">
                      <div className="w-32 truncate text-gray-700 dark:text-gray-300">{candidate}</div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="w-8 text-right text-gray-500">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};

export const ElectionsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const { elections, loading, error, reload, castBallot, hasVoted } = useElections();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [votingElection, setVotingElection] = useState<Election | null>(null);
  const [resultsElection, setResultsElection] = useState<Election | null>(null);
  const [votedSet, setVotedSet] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = (searchQuery ?? '').toLowerCase();
    return elections.filter(e => {
      if (term && !e.title.toLowerCase().includes(term)) return false;
      if (activeTab === 'active') return e.status === 'open' || e.status === 'draft';
      return e.status === 'closed' || e.status === 'tallied';
    });
  }, [elections, searchQuery, activeTab]);

  // Pre-fetch hasVoted for open elections
  useEffect(() => {
    const openIds = elections.filter(e => e.status === 'open').map(e => e.id);
    if (openIds.length === 0) return;
    Promise.all(openIds.map(id => hasVoted(id).then(v => ({ id, v })))).then(results => {
      const newSet = new Set<string>();
      results.forEach(({ id, v }) => { if (v) newSet.add(id); });
      setVotedSet(newSet);
    });
  }, [elections, hasVoted]);

  const handleCastBallot = async (votes: Record<string, string>) => {
    if (!votingElection) return;
    try {
      await castBallot(votingElection.id, votes);
      setVotedSet(prev => new Set(prev).add(votingElection.id));
      showToast('Ballot submitted successfully.', 'success');
      reload();
    } catch (e) {
      showToast((e as Error).message ?? 'Failed to submit ballot', 'error');
      throw e;
    }
  };

  const tabs = [
    { id: 'active', label: 'Active & Upcoming' },
    { id: 'past', label: 'Closed & Results' },
  ];

  if (loading) return <LoadingOverlay message="Loading elections..." />;
  if (error) return (
    <div className="p-6 text-center text-red-500 dark:text-red-400">
      <p>{error}</p>
      <Button variant="outline" onClick={reload} className="mt-3">Retry</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Elections"
        description="Participate in LO governance elections."
      />
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={t => setActiveTab(t as 'active' | 'past')}
      />

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Vote className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{activeTab === 'active' ? 'No active elections' : 'No past elections'}</p>
          <p className="text-sm mt-1">
            {activeTab === 'active'
              ? 'There are no elections open for voting at this time.'
              : 'No elections have been closed yet.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(election => {
            const alreadyVoted = votedSet.has(election.id);
            return (
              <Card key={election.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{election.title}</h3>
                      <Badge variant={STATUS_COLORS[election.status]}>{STATUS_LABELS[election.status]}</Badge>
                      {alreadyVoted && (
                        <Badge variant="success">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Voted
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(election.startDate?.toDate?.()?.toISOString?.() ?? '')} –{' '}
                        {formatDate(election.endDate?.toDate?.()?.toISOString?.() ?? '')}
                      </span>
                      <span>{election.positions.length} position{election.positions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {election.status === 'open' && !alreadyVoted && (
                      <Button variant="primary" size="sm" onClick={() => setVotingElection(election)}>
                        <Vote className="w-4 h-4 mr-1" />
                        Vote
                      </Button>
                    )}
                    {election.status === 'open' && alreadyVoted && (
                      <Button variant="outline" size="sm" disabled>
                        <Lock className="w-4 h-4 mr-1" />
                        Voted
                      </Button>
                    )}
                    {(election.status === 'tallied') && (
                      <Button variant="outline" size="sm" onClick={() => setResultsElection(election)}>
                        <BarChart2 className="w-4 h-4 mr-1" />
                        Results
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {votingElection && (
        <VoteModal
          election={votingElection}
          onClose={() => setVotingElection(null)}
          onSubmit={handleCastBallot}
        />
      )}
      {resultsElection && (
        <ResultsModal
          election={resultsElection}
          onClose={() => setResultsElection(null)}
        />
      )}
    </div>
  );
};
