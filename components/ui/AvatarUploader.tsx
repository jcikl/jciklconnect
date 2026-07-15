import React, { useRef } from 'react';
import { useToast } from './Common';
import { uploadMemberAvatarToCloudinary } from '../../services/cloudinaryService';
import type { Member } from '../../types';

interface AvatarUploaderProps {
  currentUrl: string;
  member: Member;
  uploading: boolean;
  progress: number;
  onUploadStart: () => void;
  onUploadEnd: (url?: string) => void;
  onProgress: (pct: number) => void;
  /** Called whenever the URL changes (file accepted) — before upload completes */
  onUrlChange: (url: string) => void;
  /** Tracks session-scoped URLs for cleanup; push uploaded URL here */
  sessionUploadsRef: React.MutableRefObject<string[]>;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentUrl,
  member,
  uploading,
  progress,
  onUploadStart,
  onUploadEnd,
  onProgress,
  onUrlChange,
  sessionUploadsRef,
}) => {
  const { showToast } = useToast();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'error');
      return;
    }

    onUploadStart();
    onProgress(0);
    try {
      const uploadedUrl = await uploadMemberAvatarToCloudinary(file, member, onProgress);
      sessionUploadsRef.current.push(uploadedUrl);
      onUrlChange(uploadedUrl);
      onUploadEnd(uploadedUrl);
    } catch (err) {
      console.error('Failed to upload member avatar:', err);
      showToast(err instanceof Error ? err.message : 'Failed to upload avatar.', 'error');
      onUploadEnd();
    }
  };

  return (
    <div className="flex items-center gap-4">
      <img
        src={currentUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name ?? '')}&background=0097D7&color=fff`}
        alt="Avatar"
        className="w-16 h-16 rounded-full object-cover border border-slate-200 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">Member Avatar</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload a square profile photo for member directory, dashboard, and public board display.
        </p>
        {uploading && (
          <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-jci-blue transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <label
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
            uploading
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-jci-blue text-white hover:bg-jci-navy cursor-pointer'
          }`}
        >
          {uploading ? 'Uploading...' : 'Upload Photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleChange}
          />
        </label>
      </div>
    </div>
  );
};
