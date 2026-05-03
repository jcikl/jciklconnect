import React from 'react';
import { Card } from '../ui/Common';

export const CanvaView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Canva Team Management</h2>
          <p className="text-slate-500">Manage Canva team members via the Canva API</p>
        </div>
      </div>

      <Card>
        <div className="p-6 text-center text-slate-500">
          Canva API integration coming soon...
        </div>
      </Card>
    </div>
  );
};
