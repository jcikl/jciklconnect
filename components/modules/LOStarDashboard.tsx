import React, { useState, useEffect, useCallback } from 'react';
import { Card, ProgressBar, Badge, Button } from '../ui/Common';
import { Star, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PointsService } from '../../services/pointsService';
import { useAuth } from '../../hooks/useAuth';
import { LOStarProgress } from '../../types';
import { DEFAULT_LO_ID } from '../../config/constants';
import { LoadingState } from '../ui/Loading';

export const LOStarDashboard: React.FC = () => {
    const { member } = useAuth();
    const [progress, setProgress] = useState<LOStarProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loId = member?.loId || DEFAULT_LO_ID;
    const currentYear = new Date().getFullYear();

    const loadProgress = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await PointsService.getLOStarProgress(loId, currentYear);
            setProgress(data);
        } catch (err) {
            console.error('Failed to load LO Star progress:', err);
            setError('Failed to calculate progress. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [loId, currentYear]);

    useEffect(() => {
        loadProgress();
    }, [loadProgress]);

    const getStarIcon = (unlocked: boolean) => (
        <Star 
            size={40} 
            className={`mb-2 ${unlocked ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} 
        />
    );

    const getCategoryColor = (catId: string) => {
        switch(catId) {
            case 'efficient': return 'bg-indigo-500';
            case 'network': return 'bg-blue-500';
            case 'experience': return 'bg-purple-500';
            case 'outreach': return 'bg-pink-500';
            case 'impact': return 'bg-emerald-500';
            default: return 'bg-slate-500';
        }
    };

    if (loading) return <LoadingState loading={true}><div>Calculating LO Star Progress...</div></LoadingState>;

    if (error) {
        return (
            <Card className="p-8 text-center border-red-100 bg-red-50">
                <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                <h3 className="text-lg font-bold text-red-900 mb-2">Progress calculation failed</h3>
                <p className="text-red-700 mb-4">{error}</p>
                <Button onClick={loadProgress} variant="outline" className="border-red-200 text-red-700">
                    <RefreshCw size={16} className="mr-2" /> Retry
                </Button>
            </Card>
        );
    }

    if (!progress) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card 
                title={
                    <div className="flex justify-between items-center w-full">
                        <span className="flex items-center gap-2">
                            <ShieldCheck className="text-jci-blue" size={20} />
                            LO Star Rating Progress ({currentYear})
                        </span>
                        <Badge variant="platinum" className="px-4 py-1.5 font-black uppercase tracking-widest">
                            {progress.starsUnlocked} STARS EARNED
                        </Badge>
                    </div>
                }
            >
                {/* Visual Star Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                    {Object.entries(progress.categories).map(([id, cat]) => (
                        <div 
                            key={id} 
                            className={`flex flex-col items-center text-center p-6 rounded-[2rem] border-2 transition-all duration-500 ${
                                cat.stars > 0 
                                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-lg shadow-yellow-100 scale-105' 
                                    : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
                            }`}
                        >
                            {getStarIcon(cat.stars > 0)}
                            <h4 className="font-black text-xs text-slate-900 uppercase tracking-tighter">{id}</h4>
                            <p className={`text-[10px] font-bold mt-1 uppercase ${cat.stars > 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
                                {cat.stars > 0 ? 'UNLOCKED' : 'LOCKED'}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Progress Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(progress.categories).map(([id, cat]) => {
                        const percent = Math.min(100, (cat.current / cat.total) * 100);
                        return (
                            <div key={id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{id} Performance</span>
                                        <span className="text-lg font-black text-slate-900 uppercase italic group-hover:text-jci-blue transition-colors">
                                            {id} Star
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xl font-black text-slate-900">{cat.current}</span>
                                        <span className="text-xs font-bold text-slate-400 ml-1">/ {cat.total}</span>
                                    </div>
                                </div>
                                <ProgressBar progress={percent} color={getCategoryColor(id)} />
                                <div className="mt-4 flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-slate-400 mt-0.5" />
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                        {cat.stars > 0 
                                            ? `Excellent! You've secured the ${id} Star for ${currentYear}.` 
                                            : `Earn ${cat.total - cat.current} more points in ${id} activities to unlock this star.`}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-10 p-6 bg-slate-900 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                    <div className="relative z-10">
                        <h4 className="text-white font-black text-2xl tracking-tighter uppercase italic">Total Incentive Score</h4>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Aggregated approved submissions across all categories</p>
                    </div>
                    <div className="text-center md:text-right relative z-10">
                        <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 tracking-tighter italic">
                            {progress.totalPoints.toLocaleString()}
                        </p>
                        <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Certified Points</p>
                    </div>
                    {/* Background Glow */}
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-jci-blue/20 rounded-full blur-[80px]"></div>
                </div>
            </Card>
        </div>
    );
};
