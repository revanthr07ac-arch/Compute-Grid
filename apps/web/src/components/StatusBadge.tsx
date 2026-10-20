import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'COMPLETED':
      case 'ONLINE':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'RUNNING':
      case 'BUSY':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse';
      case 'QUEUED':
      case 'IDLE':
      case 'LEASED':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'FAILED':
      case 'REVOKED':
      case 'UNHEALTHY':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'CANCELLED':
      case 'PAUSED':
      case 'OFFLINE':
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${px} ${getStyle()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current" />
      {normalized}
    </span>
  );
};
