import React, { useState, useEffect } from 'react';
import { Send, Megaphone, Edit, Trash2, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useCommunication } from '../../hooks/useCommunication';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { Textarea, Input, Select } from '../ui/Form';
import { formatRelativeTime } from '../../utils/dateUtils';
import { CommunicationService } from '../../services/communicationService';
import { NewsPost } from '../../types';

const MAX_CHARS = 500;

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
    const [notifExpanded, setNotifExpanded] = useState(false);

    const { posts, notifications, loading, error, createPost, markNotificationAsRead } = useCommunication();
    const { member } = useAuth();
    const { isBoard, isAdmin } = usePermissions();
    const { members } = useMembers();
    const { showToast } = useToast();
    const canManageAnnouncements = isBoard || isAdmin;

    const unreadCount = notifications.filter(n => !n.read).length;

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
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Communication Hub</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Announcements from the board</p>
                </div>
                {unreadCount > 0 && (
                    <Badge variant="error" className="text-xs">{unreadCount} unread</Badge>
                )}
            </div>

            {/* Mobile-only notifications panel */}
            <div className="lg:hidden">
                <button
                    onClick={() => setNotifExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Bell size={16} className="text-slate-500" />
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-jci-blue text-white text-[10px] font-bold">{unreadCount}</span>
                        )}
                    </div>
                    {notifExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>
                {notifExpanded && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <NotificationsList
                            notifications={notifications}
                            loading={loading}
                            error={error}
                            onRead={markNotificationAsRead}
                        />
                    </div>
                )}
            </div>

            {/* Main grid */}
            <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
                {/* Announcements column */}
                <div className="lg:col-span-2">
                    <Card noPadding>
                        <div className="divide-y divide-slate-100">
                            {/* Compose */}
                            {canManageAnnouncements && (
                                <div className="p-4 sm:p-5 bg-slate-50/50">
                                    <div className="flex gap-3">
                                        {member ? (
                                            <img
                                                src={member.avatar || getInitialsSvg(member.name, 36)}
                                                alt={member.name}
                                                className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0 mt-0.5"
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsSvg(member.name, 36); }}
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <Textarea
                                                placeholder="Post an announcement to all members..."
                                                value={postContent}
                                                onChange={(e) => setPostContent(e.target.value.slice(0, MAX_CHARS))}
                                                className="resize-none h-20 text-sm"
                                            />
                                            <div className="flex items-center justify-between mt-2">
                                                <span className={`text-xs ${postContent.length > MAX_CHARS * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                    {postContent.length}/{MAX_CHARS}
                                                </span>
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
                                                    {isPosting ? 'Posting...' : 'Post'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Announcements feed */}
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

                {/* Sidebar — desktop only */}
                <div className="hidden lg:block">
                    <div className="sticky top-4 space-y-4">
                        <Card>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-jci-blue text-white text-[10px] font-bold">{unreadCount} new</span>
                                )}
                            </div>
                            <div className="max-h-96 overflow-y-auto -mx-4 px-4">
                                <NotificationsList
                                    notifications={notifications}
                                    loading={loading}
                                    error={error}
                                    onRead={markNotificationAsRead}
                                />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Edit modal */}
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
            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel={confirmState.confirmLabel}
                variant={confirmState.variant}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(CONFIRM_CLOSED)}
            />
        </div>
    );
};

// ─── Notifications list (shared between mobile panel and desktop sidebar) ───

interface NotificationsListProps {
    notifications: any[];
    loading: boolean;
    error: string | null;
    onRead: (id: string) => void;
}

const NotificationsList: React.FC<NotificationsListProps> = ({ notifications, loading, error, onRead }) => (
    <LoadingState loading={loading} error={error} empty={notifications.length === 0} emptyMessage="No notifications">
        <div className="space-y-2">
            {notifications.map(notif => (
                <div
                    key={notif.id}
                    className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${notif.read ? 'bg-white border-slate-100 hover:bg-slate-50' : 'bg-blue-50 border-blue-100 hover:bg-blue-100'}`}
                    onClick={() => !notif.read && onRead(notif.id)}
                >
                    <div className="flex justify-between items-start gap-2 mb-0.5">
                        <span className={`font-semibold leading-snug ${notif.read ? 'text-slate-700' : 'text-slate-900'}`}>{notif.title}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{formatRelativeTime(notif.timestamp)}</span>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">{notif.message}</p>
                </div>
            ))}
        </div>
    </LoadingState>
);

// ─── Announcements feed ───────────────────────────────────────────────────────

interface AnnouncementsTabProps {
    posts: NewsPost[];
    loading: boolean;
    error: string | null;
    canManage: boolean;
    onEdit: (post: NewsPost) => void;
    onDelete: (postId: string) => void;
}

const AnnouncementsTab: React.FC<AnnouncementsTabProps> = ({ posts, loading, error, canManage, onEdit, onDelete }) => (
    <LoadingState loading={loading} error={error} empty={posts.length === 0} emptyMessage="No announcements yet">
        <div className="divide-y divide-slate-100">
            {posts.map(post => (
                <div key={post.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors group">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-full bg-jci-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Megaphone className="text-jci-blue" size={16} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <div>
                                    <span className="font-semibold text-slate-900 text-sm">{post.author.name}</span>
                                    <span className="text-slate-400 text-xs ml-2">{post.author.role}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-xs text-slate-400">{formatRelativeTime(post.timestamp)}</span>
                                    {canManage && (
                                        <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onEdit(post)}
                                                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                                aria-label="Edit"
                                            >
                                                <Edit size={13} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(post.id)}
                                                className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                                                aria-label="Delete"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">{post.content}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </LoadingState>
);

// ─── Edit modal ───────────────────────────────────────────────────────────────

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    announcement: NewsPost | null;
    members: any[];
    onSave: (data: any) => void | Promise<void>;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose, announcement, onSave }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [content, setContent] = useState('');

    useEffect(() => {
        setContent(announcement?.content ?? '');
    }, [announcement, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onSave({ content });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Announcement"
            size="md"
            drawerOnMobile
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Textarea
                    label="Content"
                    placeholder="Announcement content..."
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                    rows={6}
                    required
                />
                <p className="text-xs text-slate-400 text-right">{content.length}/{MAX_CHARS}</p>
                <div className="flex gap-3 pt-2">
                    <Button type="submit" className="flex-1" disabled={isSubmitting || !content.trim()}>
                        {isSubmitting ? 'Saving...' : 'Update Announcement'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
