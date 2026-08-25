import React from 'react';
import { BarChart3, Eye, MousePointerClick, TrendingUp } from 'lucide-react';
import { Badge, Card, Modal } from '../../ui/Common';
import type { Advertisement } from '../../../services/advertisementService';
import { formatDate, toDate } from '../../../utils/dateUtils';
import { formatNumber } from '../../../utils/formatUtils';

interface AdvertisementAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  advertisement: Advertisement;
  calculateCTR: (ad: Advertisement) => number;
  calculateROI: (ad: Advertisement) => {
    costPerClick: number;
    costPerImpression: number;
    totalSpent: number;
    estimatedValue: number;
  };
  drawerOnMobile?: boolean;
}

export const AdvertisementAnalyticsModal: React.FC<AdvertisementAnalyticsModalProps> = ({
  isOpen,
  onClose,
  advertisement,
  calculateCTR,
  calculateROI,
  drawerOnMobile,
}) => {
  const ctr = calculateCTR(advertisement);
  const roi = calculateROI(advertisement);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Analytics - ${advertisement.title}`} size="lg" drawerOnMobile={drawerOnMobile}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-center gap-3">
              <Eye className="text-blue-600" size={24} />
              <div>
                <p className="text-sm text-blue-600 font-medium">Impressions</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatNumber(advertisement.impressions)}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-green-50 border-green-100">
            <div className="flex items-center gap-3">
              <MousePointerClick className="text-green-600" size={24} />
              <div>
                <p className="text-sm text-green-600 font-medium">Clicks</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatNumber(advertisement.clicks)}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-purple-50 border-purple-100">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-purple-600" size={24} />
              <div>
                <p className="text-sm text-purple-600 font-medium">CTR</p>
                <h3 className="text-2xl font-bold text-slate-900">{ctr.toFixed(2)}%</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-amber-50 border-amber-100">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-amber-600" size={24} />
              <div>
                <p className="text-sm text-amber-600 font-medium">Budget</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {advertisement.budget ? `RM ${formatNumber(advertisement.budget)}` : 'N/A'}
                </h3>
              </div>
            </div>
          </Card>
        </div>

        {advertisement.budget && (
          <Card>
            <h4 className="font-semibold text-slate-900 mb-4">ROI Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Cost Per Click (CPC)</p>
                <p className="text-lg font-semibold text-slate-900">RM {roi.costPerClick.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Cost Per Impression (CPM)</p>
                <p className="text-lg font-semibold text-slate-900">RM {roi.costPerImpression.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Spent</p>
                <p className="text-lg font-semibold text-slate-900">RM {formatNumber(roi.totalSpent)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Estimated Value</p>
                <p className="text-lg font-semibold text-green-600">RM {formatNumber(roi.estimatedValue)}</p>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <h4 className="font-semibold text-slate-900 mb-4">Advertisement Details</h4>
          <div className="space-y-3">
            {advertisement.termsAndConditions && (
              <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Terms & Conditions:</span>
                <span className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {advertisement.termsAndConditions}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Status:</span>
              <Badge variant={advertisement.status === 'Active' ? 'success' : 'neutral'}>
                {advertisement.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Start Date:</span>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(toDate(advertisement.startDate).toISOString())}
              </span>
            </div>
            {advertisement.endDate && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">End Date:</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatDate(toDate(advertisement.endDate).toISOString())}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Modal>
  );
};
