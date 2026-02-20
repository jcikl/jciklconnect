import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Heart,
  Star,
  TrendingUp,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Award,
  MessageCircle,
  Plus,
  X,
  Eye,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Target,
  Zap
} from 'lucide-react';
import type {
  Member,
  MentorMatch,
} from '../../../types';
import { 
  MentorshipService, 
  MentorMatchSuggestion, 
  MentorshipCriteria,
  MentorshipStats 
} from '../../../services/mentorshipService';
import { MembersService } from '../../../services/membersService';
import { useToast } from '../../ui/Common';
import * as Forms from '../../ui/Form';

interface MentorMatchingProps {
  onClose?: () => void;
}

export const MentorMatching: React.FC<MentorMatchingProps> = ({
  onClose,
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [mentorshipStats, setMentorshipStats] = useState<MentorshipStats | null>(null);
  const [unassignedMentees, setUnassignedMentees] = useState<Member[]>([]);
  const [selectedMentee, setSelectedMentee] = useState<Member | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<MentorMatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'matching' | 'relationships'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [matchingCriteria, setMatchingCriteria] = useState<MentorshipCriteria>({});
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allMembers, stats] = await Promise.all([
        MembersService.getAllMembers(),
        MentorshipService.getMentorshipStats(),
      ]);

      setMembers(allMembers);
      setMentorshipStats(stats);
      
      // Filter unassigned mentees
      const unassigned = allMembers.filter(m => 
        !m.mentorId && 
        m.role === 'MEMBER' && 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setUnassignedMentees(unassigned);
    } catch (error) {
      console.error('Error loading mentorship data:', error);
      showToast('Failed to load mentorship data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFindMatches = async (mentee: Member) => {
    setSelectedMentee(mentee);
    setMatchingLoading(true);
    
    try {
      const matches = await MentorshipService.findPotentialMentors(mentee.id, matchingCriteria);
      setPotentialMatches(matches);
      setActiveTab('matching');
    } catch (error) {
      console.error('Error finding matches:', error);
      showToast('Failed to find potential mentors', 'error');
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleCreateMatch = async (mentorId: string, menteeId: string, score: number, factors: string[]) => {
    try {
      const match = await MentorshipService.createMentorMatch(
        mentorId,
        menteeId,
        score,
        factors,
        'current-user' // In real app, get from auth context
      );

      // Auto-approve high-scoring matches
      if (score >= 70) {
        await MentorshipService.approveMentorMatch(match.id, 'current-user');
        showToast('High-quality match created and approved automatically', 'success');
      } else {
        showToast('Match suggestion created for review', 'info');
      }

      await loadData();
      setSelectedMentee(null);
      setPotentialMatches([]);
      setActiveTab('overview');
    } catch (error) {
      console.error('Error creating match:', error);
      showToast('Failed to create mentor match', 'error');
    }
  };

  const handleAutoMatch = async (menteeId: string) => {
    try {
      const mentorId = await MentorshipService.autoMatchMentors(menteeId, matchingCriteria);
      if (mentorId) {
        showToast('Mentor automatically matched successfully', 'success');
        await loadData();
      } else {
        showToast('No suitable mentor found for automatic matching', 'info');
      }
    } catch (error) {
      console.error('Error auto-matching:', error);
      showToast('Failed to auto-match mentor', 'error');
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Intelligent Mentor Matching</h1>
          <p className="text-gray-600 mt-1">AI-powered mentor-mentee pairing system</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {mentorshipStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Mentorships</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mentorshipStats.totalMentorships}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Mentors</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mentorshipStats.activeMentors}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Unassigned Mentees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mentorshipStats.unassignedMentees}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mentorshipStats.successRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'matching', label: 'Smart Matching', icon: Zap },
              { id: 'relationships', label: 'Relationships', icon: Heart },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Forms.Input
                    placeholder="Search unassigned mentees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={<Search size={16} />}
                  />
                </div>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {/* Unassigned Mentees */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Unassigned Mentees ({unassignedMentees.length})
                  </h3>
                </div>

                {unassignedMentees.length === 0 ? (
                  <div className="text-center py-12">
                    <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">All mentees have been assigned mentors</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unassignedMentees.map((mentee) => (
                      <div key={mentee.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <img 
                            src={mentee.avatar} 
                            alt={mentee.name}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">{mentee.name}</h4>
                            <p className="text-sm text-gray-500">{mentee.profession}</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex justify-between">
                            <span>Points:</span>
                            <span>{mentee.points}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tier:</span>
                            <span className="capitalize">{mentee.tier}</span>
                          </div>
                          {mentee.skills && mentee.skills.length > 0 && (
                            <div>
                              <span>Skills:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {mentee.skills.slice(0, 3).map((skill, index) => (
                                  <span key={index} className="px-2 py-1 bg-gray-100 text-xs rounded">
                                    {skill}
                                  </span>
                                ))}
                                {mentee.skills.length > 3 && (
                                  <span className="px-2 py-1 bg-gray-100 text-xs rounded">
                                    +{mentee.skills.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFindMatches(mentee)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <Search size={14} />
                            Find Matches
                          </button>
                          <button
                            onClick={() => handleAutoMatch(mentee.id)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <Zap size={14} />
                            Auto Match
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Smart Matching Tab */}
          {activeTab === 'matching' && (
            <div className="space-y-6">
              {selectedMentee ? (
                <>
                  {/* Mentee Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={selectedMentee.avatar} 
                          alt={selectedMentee.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <h3 className="font-medium text-gray-900">Finding matches for {selectedMentee.name}</h3>
                          <p className="text-sm text-gray-500">{selectedMentee.profession}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedMentee(null);
                          setPotentialMatches([]);
                          setActiveTab('overview');
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Matching Criteria */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Matching Criteria</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Forms.Select
                        label="Experience Level"
                        value={matchingCriteria.experience || ''}
                        onChange={(e) => setMatchingCriteria(prev => ({ 
                          ...prev, 
                          experience: e.target.value as any 
                        }))}
                        options={[
                          { value: '', label: 'Any' },
                          { value: 'Senior', label: 'Senior' },
                          { value: 'Mid', label: 'Mid-level' },
                          { value: 'Junior', label: 'Junior' },
                        ]}
                      >
                        <option value="">Any</option>
                        <option value="Senior">Senior</option>
                        <option value="Mid">Mid-level</option>
                        <option value="Junior">Junior</option>
                      </Forms.Select>

                      <Forms.Select
                        label="Availability"
                        value={matchingCriteria.availability || ''}
                        onChange={(e) => setMatchingCriteria(prev => ({ 
                          ...prev, 
                          availability: e.target.value as any 
                        }))}
                        options={[
                          { value: '', label: 'Any' },
                          { value: 'High', label: 'High' },
                          { value: 'Medium', label: 'Medium' },
                          { value: 'Low', label: 'Low' },
                        ]}
                      >
                        <option value="">Any</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </Forms.Select>

                      <button
                        onClick={() => handleFindMatches(selectedMentee)}
                        disabled={matchingLoading}
                        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {matchingLoading ? 'Searching...' : 'Update Matches'}
                      </button>
                    </div>
                  </div>

                  {/* Potential Matches */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">
                      Potential Mentors ({potentialMatches.length})
                    </h4>

                    {matchingLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-500 mt-2">Finding the best matches...</p>
                      </div>
                    ) : potentialMatches.length === 0 ? (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No potential matches found</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {potentialMatches.map((match, index) => (
                          <div key={match.mentor.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <img 
                                  src={match.mentor.avatar} 
                                  alt={match.mentor.name}
                                  className="w-12 h-12 rounded-full"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium text-gray-900">{match.mentor.name}</h5>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(match.matchScore)}`}>
                                      {match.matchScore}% {getScoreLabel(match.matchScore)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">{match.mentor.profession}</p>
                                  
                                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                                    <div>
                                      <span className="font-medium">Points:</span> {match.mentor.points}
                                    </div>
                                    <div>
                                      <span className="font-medium">Tier:</span> {match.mentor.tier}
                                    </div>
                                    <div>
                                      <span className="font-medium">Role:</span> {match.mentor.role}
                                    </div>
                                    <div>
                                      <span className="font-medium">Mentees:</span> {match.mentor.menteeIds?.length || 0}
                                    </div>
                                  </div>

                                  <div className="mb-3">
                                    <p className="text-sm font-medium text-gray-700 mb-1">Matching Factors:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {match.reasons.map((reason, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                          {reason}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleCreateMatch(
                                    match.mentor.id, 
                                    selectedMentee.id, 
                                    match.matchScore, 
                                    match.reasons
                                  )}
                                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors flex items-center gap-1"
                                >
                                  <CheckCircle size={14} />
                                  Create Match
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Select a mentee from the Overview tab to find matches</p>
                </div>
              )}
            </div>
          )}

          {/* Relationships Tab */}
          {activeTab === 'relationships' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Relationship management coming soon</p>
                <p className="text-sm text-gray-400">Track active mentorships, feedback, and outcomes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};