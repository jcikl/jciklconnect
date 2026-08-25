import React from 'react';
import { createPortal } from 'react-dom';
import { Award } from 'lucide-react';
import { Button } from '../ui/Common';

interface DashboardUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardUpgradeModal: React.FC<DashboardUpgradeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-blue-50 text-jci-blue rounded-full flex items-center justify-center mx-auto mb-4">
            <Award size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Join Member to Unlock More</h3>
          <p className="text-sm text-slate-500 mb-8">
            Upgrade your account to access Projects, find Mentors, view business directories, and enjoy exclusive member benefits!
          </p>
          <div className="flex flex-col gap-3">
            <Button className="w-full" onClick={onClose}>
              Join Us Now
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
