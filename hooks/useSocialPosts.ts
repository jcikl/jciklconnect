import { useState, useEffect, useCallback } from 'react';
import { SocialPostService } from '../services/socialPostService';
import type { SocialPost, SocialPostCreateInput, SocialPostStatus } from '../types/socialPost';

export function useSocialPosts(memberId: string, isBod: boolean) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = isBod
        ? await SocialPostService.getAllPosts()
        : await SocialPostService.getMyPosts(memberId);
      setPosts(data);
      setError(null);
    } catch (e) {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [memberId, isBod]);

  useEffect(() => { if (isBod || memberId) load(); }, [memberId, isBod, load]);

  const createPost = async (input: SocialPostCreateInput, member: { id: string; name: string }) => {
    const post = await SocialPostService.createPost(input, member);
    setPosts(prev => [post, ...prev]);
    return post;
  };

  const submitForReview = async (post: SocialPost) => {
    await SocialPostService.submitForReview(post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'pending_review' as SocialPostStatus } : p));
  };

  const approvePost = async (post: SocialPost, reviewerId: string, editedContent?: string) => {
    await SocialPostService.approvePost(post.id, reviewerId, editedContent);
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, status: 'approved' as SocialPostStatus, reviewedBy: reviewerId, ...(editedContent !== undefined && { editedContent }) }
      : p));
  };

  const rejectPost = async (post: SocialPost, reviewerId: string, reason: string) => {
    await SocialPostService.rejectPost(post.id, reviewerId, reason);
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, status: 'rejected' as SocialPostStatus, reviewedBy: reviewerId, rejectionReason: reason }
      : p));
  };

  const schedulePost = async (post: SocialPost, scheduledAt: string) => {
    await SocialPostService.schedulePost(post.id, scheduledAt);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'scheduled' as SocialPostStatus, scheduledAt } : p));
  };

  const markPublished = async (post: SocialPost) => {
    await SocialPostService.markPublished(post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'published' as SocialPostStatus, publishedAt: new Date().toISOString() } : p));
  };

  const updatePost = async (id: string, updates: Partial<SocialPost>) => {
    await SocialPostService.updatePost(id, updates);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePost = async (id: string) => {
    await SocialPostService.deletePost(id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  return { posts, loading, error, createPost, submitForReview, approvePost, rejectPost, schedulePost, markPublished, updatePost, deletePost, reload: load };
}
