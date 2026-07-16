export interface ProposalVotes {
  for: number;
  against: number;
  abstain: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  status: 'Voting' | 'Approved' | 'Rejected' | 'Draft';
  votes: ProposalVotes;
  submittedDate?: string;
  votedBy?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    id: string;
    type: 'text' | 'multiple-choice' | 'rating' | 'yes-no';
    question: string;
    options?: string[];
    required: boolean;
  }>;
  targetAudience: 'All Members' | 'Board' | 'Project Leads' | 'Specific Group';
  status: 'Draft' | 'Active' | 'Closed';
  startDate: string;
  endDate: string;
  responsesCount: number;
  createdBy: string;
  createdAt: string;
}

export interface VoteOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface Vote {
  id: string;
  question: string;
  description: string;
  options: VoteOption[];
  eligibleVoters: string[];
  startDate: Date;
  endDate: Date;
  anonymous: boolean;
  status: 'draft' | 'active' | 'closed';
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface VoteCast {
  id: string;
  voteId: string;
  voterId: string;
  optionId: string;
  timestamp: Date;
}
