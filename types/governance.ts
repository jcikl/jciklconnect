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
