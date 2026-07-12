export enum UserRole {
  GUEST = 'GUEST',
  MEMBER = 'MEMBER',
  BOARD = 'BOARD',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  INACTIVE = 'INACTIVE'
}

export enum MemberTier {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum'
}


export interface RadarStats {
  training: number;
  leadership: number;
  events: number;
  recruitment: number;
  sponsorship: number;
}

export interface DashboardStats {
  totalMembers: number;
  activeProjects: number;
  upcomingEvents: number;
  financialHealth: number;
  monthlyGrowth: number;
  duesCollectedPercentage: number;
}
