import React from 'react';

interface MembersOnlyOverlayProps {
  title?: string;
  description?: string;
  /** Use compact for short containers (e.g. dashboard cards) */
  compact?: boolean;
  className?: string;
}

export const MembersOnlyOverlay: React.FC<MembersOnlyOverlayProps> = ({
  title = 'Members Only',
  description = 'This content is exclusive to JCI Kuala Lumpur members. Join us to unlock access.',
  compact = false,
  className = '',
}) => (
  <div className={`absolute inset-0 z-30 backdrop-blur-md bg-white/60 rounded-2xl ${className}`}>
    {/* Sticky inner so content stays centred in the viewport, not the (potentially tall) container */}
    <div className={compact
      ? 'flex flex-col items-center justify-center text-center px-6 h-full'
      : 'sticky top-0 flex flex-col items-center justify-center text-center px-6'
    } style={compact ? undefined : { height: 'calc(100svh - 7.75rem)' }}>
      <div className={compact ? 'mb-2' : 'mb-4'}>
        <img src="/mascot/unlock.png" alt="Members Only" className={compact ? 'w-24 h-auto' : 'w-56 h-auto'} />
      </div>
      <h3 className={compact ? 'text-sm font-black text-slate-900 mb-1' : 'text-lg font-black text-slate-900 mb-2'}>{title}</h3>
      <p className={compact ? 'text-xs text-slate-500 leading-relaxed max-w-xs' : 'text-sm text-slate-500 leading-relaxed max-w-sm'}>{description}</p>
    </div>
  </div>
);
