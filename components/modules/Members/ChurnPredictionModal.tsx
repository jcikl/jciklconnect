import * as React from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Modal } from '../../ui/Common';
import type { Member } from '../../../types';
import type { MemberChurnPrediction } from '../../../services/aiPredictionService';

interface ChurnPredictionModalProps {
  member: Member;
  prediction: MemberChurnPrediction;
  onClose: () => void;
}

export const ChurnPredictionModal: React.FC<ChurnPredictionModalProps> = ({ member, prediction, onClose }) => {
  const risk = prediction.churnRisk;
  const riskColor = risk === 'High' ? 'red' : risk === 'Medium' ? 'amber' : 'green';

  return (
    <Modal isOpen={true} onClose={onClose} title={`Churn Prediction Analysis: ${member.name}`} size="lg">
      <div className="space-y-6">
        <div className={`p-5 rounded-xl border-2 bg-${riskColor}-50 border-${riskColor}-100`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className={`text-sm font-bold text-${riskColor}-900 uppercase tracking-wider`}>Overall Risk Level</p>
              <h3 className={`text-2xl font-black text-${riskColor}-600 uppercase`}>{risk} Risk</h3>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-black text-${riskColor}-600`}>{prediction.churnProbability}%</span>
              <p className={`text-xs font-bold text-${riskColor}-900`}>Probability</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-${riskColor}-600 text-white uppercase`}>
              Priority: {prediction.interventionPriority}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h4 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
              <AlertCircle size={16} /> Risk Factors
            </h4>
            <ul className="space-y-2">
              {Array.isArray(prediction.riskFactors) && prediction.riskFactors.map((factor, idx) => (
                <li key={idx} className="text-xs text-red-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  {typeof factor === 'string' ? factor : factor.factor}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <h4 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
              <Sparkles size={16} /> Recommendations
            </h4>
            <ul className="space-y-2">
              {Array.isArray(prediction.recommendations) && prediction.recommendations.map((rec, idx) => (
                <li key={idx} className="text-xs text-green-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-green-400 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};
