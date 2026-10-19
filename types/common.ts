export enum UserRole {
  GUEST = 'GUEST',
  MEMBER = 'MEMBER',
  BOARD = 'BOARD',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  INACTIVE = 'INACTIVE',
  /**
   * External member: a JCI member of ANOTHER chapter (members.loId = a `sisterChapters` id, never 'jcikl').
   * Limited to a whitelist of modules; may only read their OWN full member doc (directory data comes
   * from `memberCards`). Lifecycle lives in `Member.affiliation`. Not part of isMember()/isActiveMember().
   */
  AFFILIATE = 'AFFILIATE',
  /**
   * Chapter administrator (分会管理人) of one external chapter, created by KL admins.
   * Everything an AFFILIATE can do, plus (rules only, Phase 0): read the full member docs of their OWN
   * chapter and update a limited set of `affiliation` fields of their chapter's AFFILIATE members.
   */
  CHAPTER_ADMIN = 'CHAPTER_ADMIN'
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
