import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { Card } from '../ui/Common';
import { Member } from '../../types';
import { PointTransaction, PointsService } from '../../services/pointsService';
import type { PointRule } from '../../services/pointsService';
import { BoardManagementService } from '../../services/boardManagementService';
import { ProjectsService } from '../../services/projectsService';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/constants';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const COLORS = ['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5', '#94A3B8'];

interface MemberGrowthChartProps {
  members?: Member[];
}

export const MemberGrowthChart: React.FC<MemberGrowthChartProps> = ({ members = [] }) => {
  const growthData = useMemo(() => {
    const now = new Date();
    const months: { name: string; members: number }[] = [];

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      // Count members joined up to this month (cumulative)
      const membersUpToMonth = members.filter(m => {
        const joinDate = new Date(m.joinDate);
        return joinDate <= new Date(date.getFullYear(), date.getMonth() + 1, 0);
      }).length;

      months.push({
        name: monthName,
        members: membersUpToMonth,
      });
    }

    return months;
  }, [members]);

  return (
    <Card title="Membership Growth (Trend)" noPadding className="h-80 flex flex-col">
      <div className="flex-1 p-6 min-h-0" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
          <AreaChart data={growthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0097D7" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#0097D7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="members" stroke="#0097D7" fillOpacity={1} fill="url(#colorMembers)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

interface PointsDistributionChartProps {
  pointHistory?: PointTransaction[];
}

export const PointsDistributionChart: React.FC<PointsDistributionChartProps> = ({ pointHistory = [] }) => {
  const pointsData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    pointHistory.forEach(transaction => {
      const category = transaction.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
    });

    // Convert to array and sort by points
    const data = Object.entries(categoryTotals)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5); // Top 5 categories

    // If no data, return default categories with 0 points
    if (data.length === 0) {
      return [
        { name: 'Projects', points: 0 },
        { name: 'Events', points: 0 },
        { name: 'Training', points: 0 },
        { name: 'Referrals', points: 0 },
        { name: 'Admin', points: 0 },
      ];
    }

    return data;
  }, [pointHistory]);

  return (
    <Card title="Engagement Points Source" noPadding className="h-80 flex flex-col">
      <div className="flex-1 px-6 pt-4 pb-6">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={pointsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="points" radius={[0, 4, 4, 0]} barSize={20}>
              {pointsData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

interface PointsSourceRadarChartProps {
  memberId?: string;
  year?: number;
  className?: string;
  lightTheme?: boolean;
}

// Map point transaction categories to radar chart dimensions
const CATEGORY_TO_DIMENSION: Record<string, string> = {
  'Leadership_Contribution': 'Leadership',
  'leadership': 'Leadership',
  'Board_Meeting': 'Leadership',
  'role_assignment': 'Leadership',
  'Event_Attendance': 'Events',
  'event_attendance': 'Events',
  'Event_Organizing': 'Events',
  'event_organizing': 'Events',
  'Member_Referral': 'Recruitment',
  'member_referral': 'Recruitment',
  'Recruitment': 'Recruitment',
  'recruitment': 'Recruitment',
  'Sponsorship': 'Sponsorship',
  'sponsorship': 'Sponsorship',
  'sponsor_secured': 'Sponsorship',
  'Training_Completion': 'Training',
  'training': 'Training',
  'Training': 'Training',
  'jci_inspire': 'Training',
};

const RADAR_DIMENSIONS = ['Leadership', 'Events', 'Recruitment', 'Sponsorship', 'Training'];

export const PointsSourceRadarChart: React.FC<PointsSourceRadarChartProps> = ({ memberId, year, className, lightTheme = false }) => {
  const [boardPositions, setBoardPositions] = useState<any[]>([]);
  const [commissionDirectorPositions, setCommissionDirectorPositions] = useState<any[]>([]);
  const [projectRoles, setProjectRoles] = useState<any[]>([]);
  const [radarContributions, setRadarContributions] = useState<any[]>([]);
  const [recruitedMembers, setRecruitedMembers] = useState<any[]>([]);
  const [sponsorshipRecords, setSponsorshipRecords] = useState<any[]>([]);
  const [pointRules, setPointRules] = useState<PointRule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadRules = async () => {
      try {
        const rules = await PointsService.getPointRules();
        if (!cancelled) setPointRules(rules);
      } catch (err) {
        console.error('Failed to load rules:', err);
      }
    };
    loadRules();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!memberId) {
      setBoardPositions([]);
      setCommissionDirectorPositions([]);
      setProjectRoles([]);
      setRadarContributions([]);
      setRecruitedMembers([]);
      setSponsorshipRecords([]);
      return;
    }

    let cancelled = false;
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Member record to get name & fullName
        const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
        const memberSnap = await getDoc(memberRef);
        if (cancelled || !memberSnap.exists()) return;
        const member = { id: memberSnap.id, ...memberSnap.data() } as any;

        // 2. Parallel fetch other documents
        const [
          positions,
          commissionPositions,
          projects,
          sponsorshipsSnap,
          contributionsSnap,
          allMembersSnap
        ] = await Promise.all([
          BoardManagementService.getMemberBoardPositions(memberId),
          BoardManagementService.getMemberCommissionDirectorPositions(memberId),
          ProjectsService.getAllProjects(),
          getDocs(query(collection(db, 'sponsorships'), where('memberId', '==', memberId))),
          getDocs(query(collection(db, 'RadarContributions'), where('memberId', '==', memberId))),
          getDocs(collection(db, COLLECTIONS.MEMBERS))
        ]);

        if (cancelled) return;

        // Save board positions
        setBoardPositions(positions);
        setCommissionDirectorPositions(commissionPositions);

        // Process project roles (Committee & Trainers)
        const roles: any[] = [];
        projects.forEach((proj: any) => {
          if (proj.committee && Array.isArray(proj.committee)) {
            proj.committee.forEach((c: any) => {
              if (c.memberId === memberId) {
                roles.push({
                  type: 'Committee',
                  date: proj.startDate || proj.proposedDate || proj.eventStartDate || '',
                });
              }
            });
          }
          if (proj.trainers && Array.isArray(proj.trainers)) {
            proj.trainers.forEach((t: any) => {
              if (t.memberId === memberId) {
                roles.push({
                  type: 'Trainer',
                  hours: parseFloat(t.durationHours) || 0,
                  date: proj.startDate || proj.proposedDate || proj.eventStartDate || '',
                });
              }
            });
          }
        });
        setProjectRoles(roles);

        // Process sponsorships
        const sponsorList: any[] = [];
        sponsorshipsSnap.forEach((doc) => {
          const data = doc.data();
          const amt = parseFloat(data.amount) || 0;
          sponsorList.push({
            amount: amt,
            date: data.createdAt?.toDate?.() || data.createdAt || '',
          });
        });
        setSponsorshipRecords(sponsorList);

        // Process contributions
        const contribList: any[] = [];
        contributionsSnap.forEach((doc) => {
          const data = doc.data();
          const rawDateVal = typeof data.eventDate === 'string'
            ? data.eventDate.trim().substring(0, 11)
            : (data.eventDate || data.createdAt?.toDate?.() || data.createdAt || '');
          contribList.push({
            points: parseFloat(data.points) || 0,
            date: rawDateVal,
          });
        });
        setRadarContributions(contribList);

        // Process recruited members
        const recruitList: any[] = [];
        const memberName = member.name || '';
        const memberFullName = member.fullName || member.general?.name || '';
        allMembersSnap.forEach((doc) => {
          const m = doc.data() as any;
          const intro = (m.introducer || '').trim().toLowerCase();
          if (intro) {
            if (
              intro === memberId.toLowerCase() ||
              (memberName && intro === memberName.trim().toLowerCase()) ||
              (memberFullName && intro === memberFullName.trim().toLowerCase())
            ) {
              recruitList.push({
                joinDate: m.joinDate || '',
              });
            }
          }
        });
        setRecruitedMembers(recruitList);

      } catch (err) {
        console.error('Error fetching data for Radar Chart:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllData();
    return () => { cancelled = true; };
  }, [memberId]);

  const data = useMemo(() => {
    const selectedYearStr = year ? String(year) : null;

    // --- Dynamic Point Rule Base Values ---
    const boardRule = pointRules.find(r => r.category === 'role_fulfillment' && r.conditions?.roleType === 'Board');
    const boardBase = boardRule ? boardRule.basePoints : 50;

    const committeeRule = pointRules.find(r => r.category === 'role_fulfillment' && r.conditions?.roleType === 'Committee');
    const committeeBase = committeeRule ? committeeRule.basePoints : 15;

    const recruitmentRule = pointRules.find(r => r.category === 'recruitment');
    const recruitBase = recruitmentRule ? recruitmentRule.basePoints : 10;

    const trainingRule = pointRules.find(r => r.category === 'training');
    const trainingBase = trainingRule ? trainingRule.basePoints : 15;

    const sponsorshipRule = pointRules.find(r => r.category === 'sponsorship_referral');
    const sponsorshipBaseMultiplier = sponsorshipRule ? sponsorshipRule.basePoints : 2;

    // --- 1. Leadership Score ---
    const activeBoards = [
      ...boardPositions.filter(pos => !selectedYearStr || pos.term === selectedYearStr),
      ...commissionDirectorPositions.filter(pos => !selectedYearStr || pos.term === selectedYearStr)
    ].length;

    const activeCommittees = projectRoles.filter(
      role => role.type === 'Committee' && (!selectedYearStr || (role.date && role.date.includes(selectedYearStr)))
    ).length;

    const leadershipScore = (activeBoards * boardBase) + (activeCommittees * committeeBase);

    // --- 2. Events Score ---
    const eventsScore = radarContributions
      .filter(contrib => {
        if (!selectedYearStr) return true;
        if (!contrib.date) return false;
        // Parse date safely
        const dateStr = typeof contrib.date === 'string' ? contrib.date : String(contrib.date);
        return dateStr.includes(selectedYearStr);
      })
      .reduce((sum, item) => sum + (item.points || 0), 0);

    // --- 3. Recruitment Score ---
    const recruitCount = recruitedMembers.filter(
      recruit => !selectedYearStr || (recruit.joinDate && recruit.joinDate.includes(selectedYearStr))
    ).length;
    const recruitmentScore = recruitCount * recruitBase;

    // --- 4. Sponsorship Score ---
    const sponsorshipScore = sponsorshipRecords
      .filter(sponsor => {
        if (!selectedYearStr) return true;
        if (!sponsor.date) return false;
        try {
          let d: Date;
          if (typeof (sponsor.date as any).toDate === 'function') {
            d = (sponsor.date as any).toDate();
          } else {
            d = new Date(sponsor.date);
          }
          return !isNaN(d.getTime()) && String(d.getFullYear()) === selectedYearStr;
        } catch {
          return false;
        }
      })
      .reduce((sum, item) => sum + Math.floor((item.amount || 0) / 100) * sponsorshipBaseMultiplier, 0);

    // --- 5. Training Score ---
    const activeTrainers = projectRoles.filter(
      role => role.type === 'Trainer' && (!selectedYearStr || (role.date && role.date.includes(selectedYearStr)))
    ).length;
    const trainingScore = activeTrainers * trainingBase;

    const totals: Record<string, number> = {
      Leadership: leadershipScore,
      Events: eventsScore,
      Recruitment: recruitmentScore,
      Sponsorship: sponsorshipScore,
      Training: trainingScore,
    };

    const maxVal = Math.max(100, ...Object.values(totals));

    return RADAR_DIMENSIONS.map(dim => ({
      subject: dim,
      A: totals[dim],
      displaySubject: `${dim}: ${totals[dim]}`,
      fullMark: maxVal,
    }));
  }, [
    year,
    pointRules,
    boardPositions,
    commissionDirectorPositions,
    projectRoles,
    radarContributions,
    recruitedMembers,
    sponsorshipRecords
  ]);

  return (
    <div className={`w-full h-full min-h-[220px] pointer-events-none ${className}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={lightTheme ? '#e2e8f0' : '#ffffff20'} />
          <PolarAngleAxis 
            dataKey="displaySubject" 
            tick={{ fill: lightTheme ? '#475569' : '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
          <Radar
            name="Points"
            dataKey="A"
            stroke={lightTheme ? '#0097D7' : '#F59E0B'}
            fill={lightTheme ? '#0097D7' : '#F59E0B'}
            fillOpacity={lightTheme ? 0.4 : 0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
