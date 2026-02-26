import React from 'react';
import { Card, ProgressBar } from '../ui/Common';
import { Star } from 'lucide-react';

export const LOStarDashboard: React.FC = () => {
    const stars = ['Efficient', 'Network', 'Experience', 'Outreach', 'Impact'];

    return (
        <div className="space-y-6">
            <Card title="LO Star Rating Progress (2026)">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {stars.map((star) => (
                        <div key={star} className="flex flex-col items-center text-center p-4 rounded-xl border opacity-50 grayscale transition-all">
                            <Star size={40} className="mb-2 text-yellow-400 fill-current" />
                            <h4 className="font-bold text-sm text-slate-700">{star} Star</h4>
                            <p className="text-xs text-slate-500">Locked</p>
                        </div>
                    ))}
                </div>

                <div className="space-y-6">
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex justify-between mb-1">
                            <span className="font-semibold text-sm text-slate-800">Efficient Star</span>
                            <span className="text-xs font-bold text-slate-700">0 / 100</span>
                        </div>
                        <ProgressBar progress={0} color="bg-indigo-500" />
                        <p className="text-xs text-slate-500 mt-2">Fundamental requirement. Must be completed to unlock other stars.</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex justify-between mb-1">
                            <span className="font-semibold text-sm text-slate-800">Network Star</span>
                            <span className="text-xs font-bold text-slate-700">0 / 250</span>
                        </div>
                        <ProgressBar progress={0} color="bg-blue-500" />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex justify-between mb-1">
                            <span className="font-semibold text-sm text-slate-800">Experience Star</span>
                            <span className="text-xs font-bold text-slate-700">0 / 250</span>
                        </div>
                        <ProgressBar progress={0} color="bg-purple-500" />
                    </div>
                    {/* Add more as needed */}
                </div>
            </Card>
        </div>
    );
};
