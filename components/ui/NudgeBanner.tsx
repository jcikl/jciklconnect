// Nudge Banner Component - Displays behavioral nudges
import React from 'react';
import { X, TrendingUp, AlertCircle, Lightbulb, Target, CheckCircle } from 'lucide-react';
import { Button, Badge } from './Common';
import { Nudge } from '../../services/behavioralNudgingService';

interface NudgeBannerProps {
  nudge: Nudge;
  onDismiss: (nudgeId: string) => void;
  onAction?: () => void;
}

export const NudgeBanner: React.FC<NudgeBannerProps> = ({ nudge, onDismiss, onAction }) => {
  const getIcon = () => {
    switch (nudge.type) {
      case 'positive_reinforcement':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'inactivity_warning':
        return <AlertCircle className="text-yellow-600" size={20} />;
      case 'opportunity_suggestion':
        return <Lightbulb className="text-blue-600" size={20} />;
      case 'goal_reminder':
        return <Target className="text-purple-600" size={20} />;
      default:
        return <TrendingUp className="text-slate-600" size={20} />;
    }
  };

  const getBgColor = () => {
    switch (nudge.type) {
      case 'positive_reinforcement':
        return 'bg-green-50 border-green-200';
      case 'inactivity_warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'opportunity_suggestion':
        return 'bg-blue-50 border-blue-200';
      case 'goal_reminder':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getPriorityBadge = () => {
    switch (nudge.priority) {
      case 'high':
        return <Badge variant="error">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium Priority</Badge>;
      case 'low':
        return <Badge variant="neutral">Low Priority</Badge>;
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getBgColor()} animate-in slide-in-from-top-5 fade-in duration-300`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-slate-900 text-sm">{nudge.title}</h4>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getPriorityBadge()}
              <button
                onClick={() => onDismiss(nudge.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-700 mb-3">{nudge.message}</p>
          {nudge.actionLabel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (nudge.actionUrl) {
                  window.location.href = nudge.actionUrl;
                }
                onAction?.();
              }}
            >
              {nudge.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

