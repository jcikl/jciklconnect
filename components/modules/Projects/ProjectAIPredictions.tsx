import React, { useState, useEffect } from 'react';
import { BrainCircuit, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button, Badge, ProgressBar, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { AIPredictionService } from '../../../services/aiPredictionService';

export const ProjectAIPredictions: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [successPrediction, setSuccessPrediction] = useState<any>(null);
  const [sponsorMatches, setSponsorMatches] = useState<any[]>([]);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [isLoadingSponsors, setIsLoadingSponsors] = useState(false);
  const [activeTab, setActiveTab] = useState<'success' | 'sponsors'>('success');
  const { showToast } = useToast();

  useEffect(() => {
    loadPredictions();
  }, [projectId]);

  const loadPredictions = async () => {
    setIsLoadingPrediction(true);
    setIsLoadingSponsors(true);
    try {
      const [prediction, sponsors] = await Promise.all([
        AIPredictionService.predictProjectSuccess(projectId),
        AIPredictionService.matchSponsors(projectId),
      ]);
      setSuccessPrediction(prediction);
      setSponsorMatches(sponsors);
    } catch (err) {
      showToast('Failed to load AI predictions', 'error');
    } finally {
      setIsLoadingPrediction(false);
      setIsLoadingSponsors(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-600 bg-green-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'High': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const FACTORS = [
    { key: 'teamExperience', label: 'Team Experience' },
    { key: 'budgetAdequacy', label: 'Budget Adequacy' },
    { key: 'timelineRealism', label: 'Timeline Realism' },
    { key: 'resourceAvailability', label: 'Resources' },
    { key: 'memberEngagement', label: 'Engagement' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BrainCircuit className="text-jci-blue flex-shrink-0" size={18} />
        <h3 className="text-base font-semibold text-slate-900">AI Insights & Recommendations</h3>
      </div>

      {/* Toggle tabs */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5">
        {(['success', 'sponsors'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab
              ? 'bg-white text-jci-blue shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab === 'success' ? 'Prediction' : 'Sponsors'}
          </button>
        ))}
      </div>

      {/* Success Prediction */}
      {activeTab === 'success' && (
        <LoadingState loading={isLoadingPrediction} error={null} empty={!successPrediction} emptyMessage="No prediction available">
          {successPrediction && (
            <div className="space-y-4">
              {/* Probability hero card */}
              <div className="rounded-xl bg-gradient-to-br from-jci-blue/5 to-indigo-50 border border-jci-blue/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Success Probability</p>
                    <div className="text-4xl font-black text-jci-blue tabular-nums leading-none">
                      {successPrediction.successProbability}%
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRiskColor(successPrediction.riskLevel)}`}>
                    {successPrediction.riskLevel} Risk
                  </span>
                </div>
                <ProgressBar progress={successPrediction.successProbability} color="primary" />
              </div>

              {/* Success Factors " divide-y list with mini bars */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Success Factors</h4>
                <div className="rounded-xl border border-slate-100 overflow-hidden bg-white divide-y divide-slate-100">
                  {FACTORS.map(f => {
                    const val: number = successPrediction.factors[f.key] ?? 0;
                    return (
                      <div key={f.key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-sm text-slate-600 w-36 flex-shrink-0">{f.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${val >= 70 ? 'bg-green-400' : val >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${val}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 tabular-nums w-10 text-right">{val}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Identified Risks */}
              {successPrediction.risks && successPrediction.risks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-500" /> Identified Risks
                  </h4>
                  <div className="space-y-2">
                    {successPrediction.risks.map((risk: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={risk.severity === 'High' ? 'error' : risk.severity === 'Medium' ? 'warning' : 'neutral'}>
                            {risk.severity}
                          </Badge>
                          <span className="text-sm font-medium text-slate-800">{risk.description}</span>
                        </div>
                        {risk.mitigation && (
                          <p className="text-xs text-slate-400 italic mt-1">Mitigation: {risk.mitigation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {successPrediction.recommendations && successPrediction.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-jci-blue" /> Recommendations
                  </h4>
                  <ul className="space-y-1.5">
                    {successPrediction.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-green-500" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </LoadingState>
      )}

      {/* Sponsor Matching */}
      {activeTab === 'sponsors' && (
        <LoadingState loading={isLoadingSponsors} error={null} empty={sponsorMatches.length === 0} emptyMessage="No sponsor matches found">
          <div className="rounded-xl border border-slate-100 overflow-hidden bg-white divide-y divide-slate-100">
            {sponsorMatches.map((match, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">{match.sponsorName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[120px]">
                        <div className="h-full rounded-full bg-jci-blue" style={{ width: `${match.matchScore}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-jci-blue tabular-nums">{match.matchScore}% match</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="flex-shrink-0">Contact</Button>
                </div>
                {match.reasons && match.reasons.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {match.reasons.map((reason: string, rIdx: number) => (
                      <li key={rIdx} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="text-jci-blue mt-0.5">¢</span>{reason}
                      </li>
                    ))}
                  </ul>
                )}
                {match.contactInfo && (
                  <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                    {match.contactInfo.email && <div>{match.contactInfo.email}</div>}
                    {match.contactInfo.phone && <div>{match.contactInfo.phone}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </LoadingState>
      )}
    </div>
  );
};
