import React, { useState, useEffect } from 'react';
import { MessageSquare, Bell, FileText, Send, MoreHorizontal, ThumbsUp, TrendingUp, TrendingDown, BarChart3, Info, X, Megaphone, Users, Calendar, Target, Edit, Trash2, Eye } from 'lucide-react';
import { Card, Button, Tabs, Badge, Modal, useToast } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { ProgressBar } from '../ui/Common';
import { useCommunication } from '../../hooks/useCommunication';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { Textarea, Input, Select, Checkbox } from '../ui/Form';
import { formatRelativeTime, formatDate } from '../../utils/dateUtils';
import { MessagingView } from './MessagingView';
import { AIPredictionService } from '../../services/aiPredictionService';
import { CommunicationService } from '../../services/communicationService';
import { NewsPost } from '../../types';

export const CommunicationView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('Newsfeed');
    const [postContent, setPostContent] = useState('');
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<NewsPost | null>(null);
    const [announcementData, setAnnouncementData] = useState({
        title: '',
        content: '',
        priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Urgent',
        targetAudience: 'All Members' as 'All Members' | 'Board Only' | 'Specific Roles' | 'Specific Members',
        selectedRoles: [] as string[],
        selectedMembers: [] as string[],
        scheduledDate: '',
        expiresDate: '',
        sendEmail: false,
        sendNotification: true,
    });
    const { posts, notifications, loading, error, createPost, likePost, markNotificationAsRead } = useCommunication();
    const { member } = useAuth();
    const { isBoard, isAdmin } = usePermissions();
    const { members } = useMembers();
    const { showToast } = useToast();
    const canManageAnnouncements = isBoard || isAdmin;

    // Analyze sentiment for posts
    const [sentimentAnalysis, setSentimentAnalysis] = useState<Record<string, any>>({});
    const [analyzingPosts, setAnalyzingPosts] = useState<Set<string>>(new Set());
    const [selectedSentimentDetail, setSelectedSentimentDetail] = useState<string | null>(null);
    const [sentimentSummary, setSentimentSummary] = useState<any>(null);
    
    // Auto-analyze sentiment for all posts when they load
    useEffect(() => {
        const analyzeAllPosts = async () => {
            for (const post of posts) {
                if (!sentimentAnalysis[post.id] && !analyzingPosts.has(post.id)) {
                    setAnalyzingPosts(prev => new Set(prev).add(post.id));
                    try {
                        const analysis = await AIPredictionService.analyzeSentiment(post.content, 'post', post.id);
                        setSentimentAnalysis(prev => ({ ...prev, [post.id]: analysis }));
                    } catch (err) {
                        // Silently fail - sentiment analysis is optional
                    } finally {
                        setAnalyzingPosts(prev => {
                            const next = new Set(prev);
                            next.delete(post.id);
                            return next;
                        });
                    }
                }
            }
        };

        if (posts.length > 0) {
            analyzeAllPosts();
        }
    }, [posts]);

    // Calculate sentiment summary
    useEffect(() => {
        if (Object.keys(sentimentAnalysis).length > 0) {
            const analyses = Object.values(sentimentAnalysis);
            const positiveCount = analyses.filter((a: any) => a.overallSentiment === 'positive').length;
            const negativeCount = analyses.filter((a: any) => a.overallSentiment === 'negative').length;
            const neutralCount = analyses.filter((a: any) => a.overallSentiment === 'neutral').length;
            const avgScore = analyses.reduce((sum: number, a: any) => sum + (a.sentimentScore || 0), 0) / analyses.length;
            
            setSentimentSummary({
                total: analyses.length,
                positive: positiveCount,
                negative: negativeCount,
                neutral: neutralCount,
                averageScore: avgScore,
                positivePercentage: (positiveCount / analyses.length) * 100,
                negativePercentage: (negativeCount / analyses.length) * 100,
            });
        }
    }, [sentimentAnalysis]);
    
    const analyzePostSentiment = async (postId: string, content: string) => {
        if (analyzingPosts.has(postId)) return;
        
        setAnalyzingPosts(prev => new Set(prev).add(postId));
        try {
            const analysis = await AIPredictionService.analyzeSentiment(content, 'post', postId);
            setSentimentAnalysis(prev => ({ ...prev, [postId]: analysis }));
        } catch (err) {
            // Silently fail - sentiment analysis is optional
        } finally {
            setAnalyzingPosts(prev => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
        }
    };

    if (activeTab === 'Messages') {
        return <MessagingView />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Communication Hub</h2>
                    <p className="text-slate-500">Stay connected with announcements and discussions.</p>
                </div>
                <div className="flex gap-2">
                    {canManageAnnouncements && activeTab === 'Announcements' && (
                        <Button onClick={() => setIsAnnouncementModalOpen(true)}>
                            <Megaphone size={16} className="mr-2" />
                            Create Announcement
                        </Button>
                    )}
                    <Button onClick={() => {
                        if (activeTab === 'Announcements' && canManageAnnouncements) {
                            setIsAnnouncementModalOpen(true);
                        } else {
                            // Handle new post
                        }
                    }}>
                        <Send size={16} className="mr-2"/> 
                        {activeTab === 'Announcements' ? 'New Announcement' : 'New Post'}
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card noPadding>
                        <div className="px-6">
                            <Tabs tabs={['Newsfeed', 'Announcements', 'Mentions', 'Messages']} activeTab={activeTab} onTabChange={setActiveTab} />
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* Create Post Input */}
                            <div className="p-4 sm:p-6 bg-slate-50/50">
                                <div className="flex gap-3 sm:gap-4">
                                    {member && (
                                        <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
                                    )}
                                    {!member && (
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0"></div>
                                    )}
                                    <div className="flex-1">
                                        <Textarea
                                            placeholder="Share an update with the LO..."
                                            value={postContent}
                                            onChange={(e) => setPostContent(e.target.value)}
                                            className="resize-none h-24"
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex gap-2 text-slate-400 text-xs">
                                                <button className="hover:text-jci-blue">Attach Image</button>
                                                <button className="hover:text-jci-blue">Add Poll</button>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    if (!member || !postContent.trim()) return;
                                                    try {
                                                        const newPostId = await createPost({
                                                            author: { name: member.name, avatar: member.avatar, role: member.role },
                                                            content: postContent,
                                                            likes: 0,
                                                            comments: 0,
                                                            type: 'Update',
                                                        });
                                                        setPostContent('');
                                                        // Analyze sentiment for the new post
                                                        if (newPostId) {
                                                            analyzePostSentiment(newPostId, postContent);
                                                        }
                                                    } catch (err) {
                                                        // Error handled in hook
                                                    }
                                                }}
                                                disabled={!member || !postContent.trim()}
                                            >
                                                Post
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feed Items */}
                            {activeTab === 'Announcements' ? (
                                <AnnouncementsTab
                                    posts={posts.filter(p => p.type === 'Announcement')}
                                    loading={loading}
                                    error={error}
                                    canManage={canManageAnnouncements}
                                    onEdit={(post) => {
                                        setSelectedAnnouncement(post);
                                        setIsAnnouncementModalOpen(true);
                                    }}
                                    onDelete={async (postId) => {
                                        if (window.confirm('Are you sure you want to delete this announcement?')) {
                                            try {
                                                await CommunicationService.deletePost(postId);
                                                showToast('Announcement deleted', 'success');
                                            } catch (err) {
                                                showToast('Failed to delete announcement', 'error');
                                            }
                                        }
                                    }}
                                />
                            ) : (
                                <LoadingState loading={loading} error={error} empty={posts.length === 0} emptyMessage="No posts yet. Be the first to share!">
                                    {posts.map(post => (
                                    <div key={post.id} className="p-6 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                {post.author.avatar ? (
                                                    <img src={post.author.avatar} alt={post.author.name} className="w-10 h-10 rounded-full" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">BOT</div>
                                                )}
                                                <div>
                                                    <h4 className="font-bold text-slate-900 text-sm">{post.author.name}</h4>
                                                    <p className="text-xs text-slate-500">{post.author.role} • {formatRelativeTime(post.timestamp)}</p>
                                                </div>
                                            </div>
                                            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={16} /></button>
                                        </div>
                                        
                                        <div className="pl-0 sm:pl-13 sm:ml-13 mb-4">
                                            <p className="text-slate-700 text-sm leading-relaxed">{post.content}</p>
                                            {post.type === 'Announcement' && (
                                                <div className="mt-3">
                                                    <Badge variant="info">Announcement</Badge>
                                                </div>
                                            )}
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                {analyzingPosts.has(post.id) ? (
                                                    <Badge variant="neutral" className="text-xs">
                                                        <span className="animate-pulse">Analyzing...</span>
                                                    </Badge>
                                                ) : sentimentAnalysis[post.id] ? (
                                                    <>
                                                        <button
                                                            onClick={() => setSelectedSentimentDetail(post.id)}
                                                            className="cursor-pointer"
                                                        >
                                                            <Badge 
                                                                variant={
                                                                    sentimentAnalysis[post.id].overallSentiment === 'positive' ? 'success' :
                                                                    sentimentAnalysis[post.id].overallSentiment === 'negative' ? 'error' : 'neutral'
                                                                }
                                                                className="text-xs hover:opacity-80 transition-opacity"
                                                            >
                                                                {sentimentAnalysis[post.id].overallSentiment === 'positive' ? '😊 Positive' :
                                                                 sentimentAnalysis[post.id].overallSentiment === 'negative' ? '😟 Negative' : '😐 Neutral'}
                                                                {sentimentAnalysis[post.id].sentimentScore !== undefined && (
                                                                    <span className="ml-1">
                                                                        ({sentimentAnalysis[post.id].sentimentScore > 0 ? '+' : ''}{Math.round(sentimentAnalysis[post.id].sentimentScore)})
                                                                    </span>
                                                                )}
                                                            </Badge>
                                                        </button>
                                                        {sentimentAnalysis[post.id].keyTopics && sentimentAnalysis[post.id].keyTopics.length > 0 && (
                                                            <div className="flex gap-1 flex-wrap">
                                                                {sentimentAnalysis[post.id].keyTopics.slice(0, 3).map((topic: string, idx: number) => (
                                                                    <Badge key={idx} variant="neutral" className="text-xs">
                                                                        #{topic}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 text-slate-500 text-sm">
                                            <button
                                                className="flex items-center gap-2 hover:text-jci-blue"
                                                onClick={() => likePost(post.id)}
                                                disabled={!member}
                                            >
                                                <ThumbsUp size={16} /> {post.likes || 0} Likes
                                            </button>
                                            <button className="flex items-center gap-2 hover:text-jci-blue"><MessageSquare size={16} /> {post.comments || 0} Comments</button>
                                        </div>
                                    </div>
                                ))}
                            </LoadingState>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    {/* Sentiment Analysis Summary */}
                    {sentimentSummary && (
                        <Card title="Sentiment Overview" className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {sentimentSummary.averageScore > 0 ? '+' : ''}{Math.round(sentimentSummary.averageScore)}
                                        </div>
                                        <div className="text-xs text-slate-600">Average Sentiment Score</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-slate-900">{sentimentSummary.total} Posts</div>
                                        <div className="text-xs text-slate-600">Analyzed</div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="text-green-600" size={16} />
                                            <span className="text-slate-700">Positive</span>
                                        </div>
                                        <span className="font-semibold text-slate-900">
                                            {sentimentSummary.positive} ({Math.round(sentimentSummary.positivePercentage)}%)
                                        </span>
                                    </div>
                                    <ProgressBar progress={sentimentSummary.positivePercentage} color="bg-green-500" />
                                    
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-700">Neutral</span>
                                        </div>
                                        <span className="font-semibold text-slate-900">
                                            {sentimentSummary.neutral} ({Math.round((sentimentSummary.neutral / sentimentSummary.total) * 100)}%)
                                        </span>
                                    </div>
                                    <ProgressBar progress={(sentimentSummary.neutral / sentimentSummary.total) * 100} color="bg-slate-400" />
                                    
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="text-red-600" size={16} />
                                            <span className="text-slate-700">Negative</span>
                                        </div>
                                        <span className="font-semibold text-slate-900">
                                            {sentimentSummary.negative} ({Math.round(sentimentSummary.negativePercentage)}%)
                                        </span>
                                    </div>
                                    <ProgressBar progress={sentimentSummary.negativePercentage} color="bg-red-500" />
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card title="Notifications">
                        <LoadingState loading={loading} error={error} empty={notifications.length === 0} emptyMessage="No notifications">
                            <div className="space-y-3">
                                {notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                                            notif.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'
                                        }`}
                                        onClick={() => !notif.read && markNotificationAsRead(notif.id)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-semibold ${notif.read ? 'text-slate-700' : 'text-slate-900'}`}>{notif.title}</span>
                                            <span className="text-[10px] text-slate-400">{formatRelativeTime(notif.timestamp)}</span>
                                        </div>
                                        <p className="text-slate-600 text-xs">{notif.message}</p>
                                    </div>
                                ))}
                            </div>
                        </LoadingState>
                    </Card>

                     <Card title="Quick Links" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none">
                        <div className="space-y-2">
                            <button className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-2 text-sm">
                                <FileText size={16} className="text-slate-400" /> Policy Documents
                            </button>
                             <button className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-2 text-sm">
                                <FileText size={16} className="text-slate-400" /> Branding Guidelines
                            </button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Sentiment Detail Modal */}
            {selectedSentimentDetail && sentimentAnalysis[selectedSentimentDetail] && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedSentimentDetail(null)}
                    title="Sentiment Analysis Details"
                    size="lg"
                >
                    <div className="space-y-6">
                        {(() => {
                            const analysis = sentimentAnalysis[selectedSentimentDetail];
                            return (
                                <>
                                    {/* Overall Sentiment */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-slate-900">Overall Sentiment</h4>
                                            <Badge 
                                                variant={
                                                    analysis.overallSentiment === 'positive' ? 'success' :
                                                    analysis.overallSentiment === 'negative' ? 'error' : 'neutral'
                                                }
                                            >
                                                {analysis.overallSentiment === 'positive' ? '😊 Positive' :
                                                 analysis.overallSentiment === 'negative' ? '😟 Negative' : '😐 Neutral'}
                                            </Badge>
                                        </div>
                                        <div className="text-3xl font-bold text-slate-900">
                                            {analysis.sentimentScore > 0 ? '+' : ''}{Math.round(analysis.sentimentScore)}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">Sentiment Score (-100 to +100)</div>
                                    </div>

                                    {/* Emotions */}
                                    {analysis.emotions && (
                                        <div>
                                            <h4 className="font-semibold text-slate-900 mb-3">Emotion Analysis</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(analysis.emotions).map(([emotion, score]: [string, any]) => (
                                                    <div key={emotion} className="bg-slate-50 rounded-lg p-3">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-sm font-medium text-slate-700 capitalize">{emotion}</span>
                                                            <span className="text-xs font-semibold text-slate-900">{Math.round(score)}%</span>
                                                        </div>
                                                        <ProgressBar progress={score} color={
                                                            emotion === 'joy' || emotion === 'trust' ? 'bg-green-500' :
                                                            emotion === 'fear' || emotion === 'anger' || emotion === 'sadness' ? 'bg-red-500' :
                                                            'bg-blue-500'
                                                        } />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Key Topics */}
                                    {analysis.keyTopics && analysis.keyTopics.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-slate-900 mb-3">Key Topics</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {analysis.keyTopics.map((topic: string, idx: number) => (
                                                    <Badge key={idx} variant="info">{topic}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actionable Insights */}
                                    {analysis.actionableInsights && analysis.actionableInsights.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                <Info className="text-blue-600" size={18} />
                                                Actionable Insights
                                            </h4>
                                            <ul className="space-y-2">
                                                {analysis.actionableInsights.map((insight: string, idx: number) => (
                                                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-blue-50 p-3 rounded-lg">
                                                        <span className="text-blue-600 mt-0.5">•</span>
                                                        <span>{insight}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </Modal>
            )}

            {/* Announcement Creation/Edit Modal */}
            <AnnouncementModal
                isOpen={isAnnouncementModalOpen}
                onClose={() => {
                    setIsAnnouncementModalOpen(false);
                    setSelectedAnnouncement(null);
                    setAnnouncementData({
                        title: '',
                        content: '',
                        priority: 'Normal',
                        targetAudience: 'All Members',
                        selectedRoles: [],
                        selectedMembers: [],
                        scheduledDate: '',
                        expiresDate: '',
                        sendEmail: false,
                        sendNotification: true,
                    });
                }}
                announcement={selectedAnnouncement}
                members={members}
                onSave={async (data) => {
                    if (!member) return;
                    
                    try {
                        const postData: Omit<NewsPost, 'id' | 'timestamp'> = {
                            author: { name: member.name, avatar: member.avatar, role: member.role },
                            content: data.content,
                            likes: 0,
                            comments: 0,
                            type: 'Announcement',
                        };

                        if (selectedAnnouncement) {
                            await CommunicationService.updatePost(selectedAnnouncement.id, postData);
                            showToast('Announcement updated', 'success');
                        } else {
                            // Create announcement with distribution
                            const result = await CommunicationService.createAnnouncement(
                                {
                                    title: data.title,
                                    content: data.content,
                                    priority: data.priority,
                                    targetAudience: data.targetAudience,
                                    selectedRoles: data.selectedRoles,
                                    selectedMembers: data.selectedMembers,
                                    scheduledDate: data.scheduledDate,
                                    expiresDate: data.expiresDate,
                                    sendEmail: data.sendEmail,
                                    sendNotification: data.sendNotification,
                                },
                                member.id
                            );
                            
                            if (result.emailsSent > 0 || result.notificationsSent > 0) {
                                showToast(
                                    `Announcement created: ${result.emailsSent} emails sent, ${result.notificationsSent} notifications sent`,
                                    'success'
                                );
                            } else {
                                showToast('Announcement created', 'success');
                            }
                        }
                        
                        setIsAnnouncementModalOpen(false);
                        setSelectedAnnouncement(null);
                    } catch (err) {
                        showToast('Failed to save announcement', 'error');
                    }
                }}
            />
        </div>
    );
};

// Announcements Tab Component
interface AnnouncementsTabProps {
    posts: NewsPost[];
    loading: boolean;
    error: string | null;
    canManage: boolean;
    onEdit: (post: NewsPost) => void;
    onDelete: (postId: string) => void;
}

const AnnouncementsTab: React.FC<AnnouncementsTabProps> = ({ posts, loading, error, canManage, onEdit, onDelete }) => {

    return (
        <LoadingState loading={loading} error={error} empty={posts.length === 0} emptyMessage="No announcements yet">
            <div className="divide-y divide-slate-100">
                {posts.map(post => (
                    <div key={post.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="w-12 h-12 rounded-full bg-jci-blue/10 flex items-center justify-center flex-shrink-0">
                                    <Megaphone className="text-jci-blue" size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-slate-900">{post.author.name}</h4>
                                        <Badge variant="info">Announcement</Badge>
                                    </div>
                                    <p className="text-xs text-slate-500">{post.author.role} • {formatRelativeTime(post.timestamp)}</p>
                                </div>
                            </div>
                            {canManage && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEdit(post)}
                                    >
                                        <Edit size={14} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDelete(post.id)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="pl-15 mb-4">
                            <p className="text-slate-700 leading-relaxed">{post.content}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                                <Eye size={14} />
                                <span>{post.likes || 0} views</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </LoadingState>
    );
};

// Announcement Modal Component
interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    announcement: NewsPost | null;
    members: any[];
    onSave: (data: any) => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose, announcement, members, onSave }) => {
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Urgent',
        targetAudience: 'All Members' as 'All Members' | 'Board Only' | 'Specific Roles' | 'Specific Members',
        selectedRoles: [] as string[],
        selectedMembers: [] as string[],
        scheduledDate: '',
        expiresDate: '',
        sendEmail: false,
        sendNotification: true,
    });

    useEffect(() => {
        if (announcement) {
            setFormData({
                title: announcement.content.split('\n')[0] || '',
                content: announcement.content,
                priority: 'Normal',
                targetAudience: 'All Members',
                selectedRoles: [],
                selectedMembers: [],
                scheduledDate: '',
                expiresDate: '',
                sendEmail: false,
                sendNotification: true,
            });
        } else {
            setFormData({
                title: '',
                content: '',
                priority: 'Normal',
                targetAudience: 'All Members',
                selectedRoles: [],
                selectedMembers: [],
                scheduledDate: '',
                expiresDate: '',
                sendEmail: false,
                sendNotification: true,
            });
        }
    }, [announcement, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        onSave(formData);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={announcement ? 'Edit Announcement' : 'Create Announcement'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Title"
                    placeholder="Announcement title..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                />

                <Textarea
                    label="Content"
                    placeholder="Announcement content..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                    required
                />

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Priority"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        options={[
                            { label: 'Low', value: 'Low' },
                            { label: 'Normal', value: 'Normal' },
                            { label: 'High', value: 'High' },
                            { label: 'Urgent', value: 'Urgent' },
                        ]}
                    />
                    <Select
                        label="Target Audience"
                        value={formData.targetAudience}
                        onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value as any })}
                        options={[
                            { label: 'All Members', value: 'All Members' },
                            { label: 'Board Only', value: 'Board Only' },
                            { label: 'Specific Roles', value: 'Specific Roles' },
                            { label: 'Specific Members', value: 'Specific Members' },
                        ]}
                    />
                </div>

                {formData.targetAudience === 'Specific Roles' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Select Roles</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                            {['MEMBER', 'BOARD', 'ADMIN', 'PROJECT_LEAD', 'COMMITTEE_CHAIR'].map(role => (
                                <label key={role} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.selectedRoles.includes(role)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, selectedRoles: [...formData.selectedRoles, role] });
                                            } else {
                                                setFormData({ ...formData, selectedRoles: formData.selectedRoles.filter(r => r !== role) });
                                            }
                                        }}
                                        className="rounded border-slate-300"
                                    />
                                    <span className="text-sm text-slate-700">{role}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {formData.targetAudience === 'Specific Members' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Select Members</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                            {members.map(m => (
                                <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.selectedMembers.includes(m.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, selectedMembers: [...formData.selectedMembers, m.id] });
                                            } else {
                                                setFormData({ ...formData, selectedMembers: formData.selectedMembers.filter(id => id !== m.id) });
                                            }
                                        }}
                                        className="rounded border-slate-300"
                                    />
                                    <img src={m.avatar} alt={m.name} className="w-6 h-6 rounded-full" />
                                    <span className="text-sm text-slate-700">{m.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Scheduled Date (Optional)"
                        type="datetime-local"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    />
                    <Input
                        label="Expires Date (Optional)"
                        type="datetime-local"
                        value={formData.expiresDate}
                        onChange={(e) => setFormData({ ...formData, expiresDate: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.sendNotification}
                            onChange={(e) => setFormData({ ...formData, sendNotification: e.target.checked })}
                            className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">Send in-app notification</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.sendEmail}
                            onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                            className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">Send email notification</span>
                    </label>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1">
                        <Send size={16} className="mr-2" />
                        {announcement ? 'Update Announcement' : 'Publish Announcement'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
