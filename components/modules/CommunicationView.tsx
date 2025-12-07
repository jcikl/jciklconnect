import React, { useState } from 'react';
import { MessageSquare, Bell, FileText, Send, MoreHorizontal, ThumbsUp } from 'lucide-react';
import { Card, Button, Tabs, Badge } from '../ui/Common';
import { MOCK_POSTS, MOCK_NOTIFICATIONS } from '../../services/mockData';

export const CommunicationView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('Newsfeed');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Communication Hub</h2>
                    <p className="text-slate-500">Stay connected with announcements and discussions.</p>
                </div>
                <Button><Send size={16} className="mr-2"/> New Post</Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card noPadding>
                        <div className="px-6">
                            <Tabs tabs={['Newsfeed', 'Announcements', 'Mentions']} activeTab={activeTab} onTabChange={setActiveTab} />
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* Create Post Input */}
                            <div className="p-6 bg-slate-50/50">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <textarea 
                                            placeholder="Share an update with the LO..." 
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-jci-blue focus:border-jci-blue resize-none h-24"
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex gap-2 text-slate-400 text-xs">
                                                <button className="hover:text-jci-blue">Attach Image</button>
                                                <button className="hover:text-jci-blue">Add Poll</button>
                                            </div>
                                            <Button size="sm">Post</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feed Items */}
                            {MOCK_POSTS.map(post => (
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
                                                <p className="text-xs text-slate-500">{post.author.role} • {post.timestamp}</p>
                                            </div>
                                        </div>
                                        <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={16} /></button>
                                    </div>
                                    
                                    <div className="pl-13 ml-13 mb-4">
                                        <p className="text-slate-700 text-sm leading-relaxed">{post.content}</p>
                                        {post.type === 'Announcement' && (
                                            <div className="mt-3">
                                                <Badge variant="info">Announcement</Badge>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-6 text-slate-500 text-sm">
                                        <button className="flex items-center gap-2 hover:text-jci-blue"><ThumbsUp size={16} /> {post.likes} Likes</button>
                                        <button className="flex items-center gap-2 hover:text-jci-blue"><MessageSquare size={16} /> {post.comments} Comments</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Notifications">
                         <div className="space-y-3">
                            {MOCK_NOTIFICATIONS.map(notif => (
                                <div key={notif.id} className={`p-3 rounded-lg border text-sm ${notif.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`font-semibold ${notif.read ? 'text-slate-700' : 'text-slate-900'}`}>{notif.title}</span>
                                        <span className="text-[10px] text-slate-400">{notif.timestamp}</span>
                                    </div>
                                    <p className="text-slate-600 text-xs">{notif.message}</p>
                                </div>
                            ))}
                         </div>
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
        </div>
    );
};
