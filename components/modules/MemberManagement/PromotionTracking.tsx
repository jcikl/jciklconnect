import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, CheckCircle, Clock, Award, AlertCircle, 
  Calendar, FileText, User, Users, RefreshCw, Check, X 
} from 'lucide-react';
import { Card, Button, Badge, ProgressBar, Modal, useToast } from '../../ui/Common';
import { PromotionService } from '../../../services/promotionService';
import { 
  PromotionProgress, 
  PromotionHistory, 
  ManualPromotionRequest 
} from '../../../types';

export const PromotionTracking: React.FC = () => {
  const [probationMembers, setProbationMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [promotionProgress, setPromotionProgress] = useState<PromotionProgress | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showManualPromotionModal, setShowManualPromotionModal] = useState(false);
  const [manualPromotionReason, setManualPromotionReason] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, list] = await Promise.all([
        PromotionService.getPromotionStatistics(),
        PromotionService.getProbationMembersForDisplay()
      ]);
      setStatistics(stats);
      setProbationMembers(list);
    } catch (err) {
      showToast('Failed to load promotion data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProgress = async (memberId: string) => {
    setLoading(true);
    try {
      const progress = await PromotionService.getPromotionProgress(memberId);
      setPromotionProgress(progress);
      setSelectedMemberId(memberId);
    } catch (err) {
      showToast('Failed to load promotion progress', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteMember = async (memberId: string, method: 'automatic' | 'manual' = 'automatic') => {
    try {
      const promotion = await PromotionService.promoteToFullMember(
        memberId,
        'current_user_id', // Would come from auth context
        method,
        method === 'manual' ? manualPromotionReason : undefined
      );
      
      if (promotion) {
        showToast('Member promoted successfully!', 'success');
        setShowManualPromotionModal(false);
        setManualPromotionReason('');
        loadData();
        setPromotionProgress(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to promote member', 'error');
    }
  };

  const handleManualPromotionRequest = async () => {
    if (!selectedMemberId || !manualPromotionReason.trim()) {
      showToast('Please provide a reason for manual promotion', 'warning');
      return;
    }

    try {
      await PromotionService.createManualPromotionRequest(
        selectedMemberId,
        'current_user_id', // Would come from auth context
        manualPromotionReason,
        true // Override requirements
      );
      
      showToast('Manual promotion request submitted', 'success');
      setShowManualPromotionModal(false);
      setManualPromotionReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit promotion request', 'error');
    }
  };

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      {statistics && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 mb-1">Probation Members</div>
                <div className="text-2xl font-bold text-slate-900">{statistics.totalProbationMembers}</div>
              </div>
              <Users className="text-blue-600" size={32} />
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 mb-1">Eligible for Promotion</div>
                <div className="text-2xl font-bold text-green-600">{statistics.eligibleForPromotion}</div>
              </div>
              <CheckCircle className="text-green-600" size={32} />
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 mb-1">Promoted This Year</div>
                <div className="text-2xl font-bold text-purple-600">{statistics.promotedThisYear}</div>
              </div>
              <TrendingUp className="text-purple-600" size={32} />
            </div>
          </Card>
          
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 mb-1">Avg. Time to Promotion</div>
                <div className="text-2xl font-bold text-amber-600">{statistics.averageTimeToPromotion} days</div>
              </div>
              <Clock className="text-amber-600" size={32} />
            </div>
          </Card>
        </div>
      )}

      {/* Requirement Completion Rates */}
      {statistics && (
        <Card title="Requirement Completion Rates">
          <div className="space-y-4">
            {Object.entries(statistics.requirementCompletionRates).map(([type, rate]: [string, any]) => (
              <div key={type}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{rate.toFixed(1)}%</span>
                </div>
                <ProgressBar progress={rate} color="bg-blue-600" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Probation Members List */}
      <Card title="Probation Members">
        <div className="space-y-3">
          {probationMembers.map(member => (
            <div 
              key={member.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                  {member.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{member.name}</div>
                  <div className="text-xs text-slate-500">Joined: {member.joinDate}</div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleViewProgress(member.id)}
              >
                View Progress
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Promotion Progress Modal */}
      <Modal
        isOpen={!!promotionProgress}
        onClose={() => {
          setPromotionProgress(null);
          setSelectedMemberId(null);
        }}
        title="Promotion Progress"
      >
        {promotionProgress && (
          <div className="space-y-6">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">Overall Progress</span>
                <span className="text-sm font-semibold text-slate-900">
                  {promotionProgress.overallProgress.toFixed(0)}%
                </span>
              </div>
              <ProgressBar 
                progress={promotionProgress.overallProgress} 
                color={promotionProgress.isEligibleForPromotion ? 'bg-green-600' : 'bg-blue-600'} 
              />
            </div>

            {/* Requirements Checklist */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900">Requirements</h4>
              {promotionProgress.requirements.map(req => (
                <div 
                  key={req.id}
                  className={`p-4 rounded-lg border-2 ${
                    req.isCompleted 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`mt-0.5 ${req.isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                        {req.isCompleted ? <CheckCircle size={20} /> : <Clock size={20} />}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{req.name}</div>
                        <div className="text-sm text-slate-600 mt-1">{req.description}</div>
                        {req.isCompleted && req.completedAt && (
                          <div className="text-xs text-green-600 mt-2">
                            Completed: {new Date(req.completedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    {req.isCompleted && (
                      <Badge variant="success">Complete</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {promotionProgress.isEligibleForPromotion ? (
                <Button 
                  className="flex-1"
                  onClick={() => handlePromoteMember(promotionProgress.memberId, 'automatic')}
                >
                  <Award size={16} className="mr-2" />
                  Promote to Full Member
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowManualPromotionModal(true)}
                >
                  <FileText size={16} className="mr-2" />
                  Request Manual Promotion
                </Button>
              )}
            </div>

            {/* Promotion Info */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Promotion Details</p>
                  <p>Current Dues: RM350 (Probation)</p>
                  <p>New Dues: RM300 (Full Member)</p>
                  <p className="mt-2 text-xs text-blue-700">
                    Upon promotion, the member's dues will be automatically adjusted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Promotion Request Modal */}
      <Modal
        isOpen={showManualPromotionModal}
        onClose={() => {
          setShowManualPromotionModal(false);
          setManualPromotionReason('');
        }}
        title="Manual Promotion Request"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="text-amber-600 mt-0.5" size={16} />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Manual Override</p>
                <p>
                  This member has not completed all requirements. Please provide a reason
                  for manual promotion approval.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason for Manual Promotion
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              value={manualPromotionReason}
              onChange={(e) => setManualPromotionReason(e.target.value)}
              placeholder="Explain why this member should be promoted despite not meeting all requirements..."
            />
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowManualPromotionModal(false);
                setManualPromotionReason('');
              }}
            >
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleManualPromotionRequest}
              disabled={!manualPromotionReason.trim()}
            >
              <Check size={16} className="mr-2" />
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
