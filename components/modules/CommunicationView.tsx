import React, { useState, useEffect } from 'react';
import { FileText, Send, Megaphone, Edit, Trash2, Eye } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useCommunication } from '../../hooks/useCommunication';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { Textarea, Input, Select, Checkbox } from '../ui/Form';
import { formatRelativeTime } from '../../utils/dateUtils';
import { CommunicationService } from '../../services/communicationService';
import { NewsPost } from '../../types';

// Generate an inline SVG data URI with initials — avoids external requests blocked by CSP
const getInitialsSvg = (name: string, size = 48): string => {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const CommunicationView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
    const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
    const [postContent, setPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<NewsPost | null>(null);
    const { posts, notifications, loading, error, createPost, markNotificationAsRead } = useCommunication();
    const { member } = useAuth();
    const { isBoard, isAdmin } = usePermissions();
    const { members } = useMembers();
    const { showToast } = useToast();
    const canManageAnnouncements = isBoard || isAdmin;

    const filteredAnnouncements = React.useMemo(() => {
        const term = (searchQuery || '').toLowerCase();
        const announcements = posts.filter(p => p.type === 'Announcement');
        if (!term) return announcements;
        return announcements.filter(p =>
            (p.content ?? '').toLowerCase().includes(term) ||
            (p.author?.name ?? '').toLowerCase().includes(term)
        );
    }, [posts, searchQuery]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Communication Hub</h2>
                <p className="text-slate-500">Stay connected with announcements and discussions.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card noPadding>
                        <div className="divide-y divide-slate-100">
                            {/* Create Announcement Input */}
                            {canManageAnnouncements && (
                                <div className="p-4 sm:p-6 bg-slate-50/50">
                                    <div className="flex gap-3 sm:gap-4">
                                        {member ? (
                                            <img src={member.avatar || getInitialsSvg(member.name, 40)} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsSvg(member.name, 40); }} />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <Textarea
                                                placeholder="Post an announcement..."
                                                value={postContent}
                                                onChange={(e) => setPostContent(e.target.value)}
                                                className="resize-none h-24"
                                            />
                                            <div className="flex justify-end mt-2">
                                                <Button
                                                    size="sm"
                                                    onClick={async () => {
                                                        if (!member || !postContent.trim() || isPosting) return;
                                                        setIsPosting(true);
                                                        try {
                                                            await createPost({
                                                                author: { name: member.name, avatar: member.avatar, role: member.role },
                                                                content: postContent,
                                                                likes: 0,
                                                                comments: 0,
                                                                type: 'Announcement',
                                                            });
                                                            setPostContent('');
                                                        } catch (err) {
                                                            showToast('Failed to post announcement', 'error');
                                                        } finally {
                                                            setIsPosting(false);
                                                        }
                                                    }}
                                                    disabled={!postContent.trim() || isPosting}
                                                >
                                                    Post
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Announcements Feed */}
                            <AnnouncementsTab
                                posts={filteredAnnouncements}
                                loading={loading}
                                error={error}
                                canManage={canManageAnnouncements}
                                onEdit={(post) => {
                                    setSelectedAnnouncement(post);
                                    setIsAnnouncementModalOpen(true);
                                }}
                                onDelete={(postId) => {
                                    setConfirmState({
                                        open: true,
                                        title: 'Delete Announcement',
                                        message: 'Are you sure you want to delete this announcement?',
                                        variant: 'danger',
                                        onConfirm: async () => {
                                            setConfirmState(CONFIRM_CLOSED);
                                            try {
                                                await CommunicationService.deletePost(postId);
                                                showToast('Announcement deleted', 'success');
                                            } catch (err) {
                                                showToast('Failed to delete announcement', 'error');
                                            }
                                        },
                                    });
                                }}
                            />
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Notifications">
                        <LoadingState loading={loading} error={error} empty={notifications.length === 0} emptyMessage="No notifications">
                            <div className="space-y-3">
                                {notifications.map(notif => (
                                    <div
                                        key={notif.id}
                                        className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${notif.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'
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

            {/* Announcement Edit Modal */}
            <AnnouncementModal
                isOpen={isAnnouncementModalOpen}
                onClose={() => {
                    setIsAnnouncementModalOpen(false);
                    setSelectedAnnouncement(null);
                }}
                announcement={selectedAnnouncement}
                members={members}
                onSave={async (data) => {
                    if (!member || !selectedAnnouncement) return;
                    try {
                        await CommunicationService.updatePost(selectedAnnouncement.id, {
                            author: { name: member.name, avatar: member.avatar, role: member.role },
                            content: data.content,
                            likes: selectedAnnouncement.likes,
                            comments: selectedAnnouncement.comments,
                            type: 'Announcement',
                        });
                        showToast('Announcement updated', 'success');
                        setIsAnnouncementModalOpen(false);
                        setSelectedAnnouncement(null);
                    } catch (err) {
                        showToast('Failed to update announcement', 'error');
                    }
                }}
            />
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
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
    onSave: (data: any) => void | Promise<void>;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose, announcement, members, onSave }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onSave(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={announcement ? 'Edit Announcement' : 'Create Announcement'}
            size="lg"
            drawerOnMobile
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
                                    <img src={m.avatar || getInitialsSvg(m.name, 24)} alt={m.name} className="w-6 h-6 rounded-full" onError={(e) => { e.currentTarget.src = getInitialsSvg(m.name, 24); }} />
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
                    <Button type="submit" className="flex-1" disabled={isSubmitting}>
                        <Send size={16} className="mr-2" />
                        {isSubmitting ? 'Saving...' : (announcement ? 'Update Announcement' : 'Publish Announcement')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
