export interface Candidate {
  id: string;
  name: string;
  position: string;
  avatar: string;
  votes?: number;
  memberId: string;
  positionId: string;
  statement: string;
  nominatedBy: string;
  nominatedAt: Date;
}

export interface ElectionPosition {
  id: string;
  title: string;
  seats: number;
  candidates: Candidate[];
}

export interface Election {
  id: string;
  title: string;
  status: 'Active' | 'Completed' | 'Upcoming' | 'Cancelled';
  startDate?: string;
  endDate: string;
  candidates: Candidate[];
  totalVotes?: number;
  votedBy?: string[];
  description?: string;
  name: string;
  positions: ElectionPosition[];
  nominationStartDate: Date;
  nominationEndDate: Date;
  votingStartDate: Date;
  votingEndDate: Date;
  votingMethod: 'plurality' | 'ranked_choice' | 'approval';
  electionStatus: 'nomination' | 'voting' | 'completed';
}

export interface ElectionBallot {
  id: string;
  electionId: string;
  voterId: string;
  votes: Record<string, string | string[]>;
  timestamp: Date;
}

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
