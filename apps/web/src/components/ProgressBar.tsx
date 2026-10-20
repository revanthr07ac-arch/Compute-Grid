import React from 'react';

interface ProgressBarProps {
  progress: number;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  status?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showText = true,
  size = 'md',
  status = 'RUNNING',
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));

  const getHeight = () => {
    switch (size) {
      case 'sm':
        return 'h-1.5';
      case 'lg':
        return 'h-3';
      case 'md':
      default:
        return 'h-2';
    }
  };

  const getColor = () => {
    if (status === 'COMPLETED') return 'bg-emerald-500 shadow-emerald-500/50';
    if (status === 'FAILED') return 'bg-rose-500 shadow-rose-500/50';
    return 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-blue-500/50';
  };

  return (
    <div className="w-full">
      {showText && (
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-slate-400 font-medium">Completion</span>
          <span className="text-slate-200 font-semibold">{clamped}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-800/80 rounded-full overflow-hidden ${getHeight()}`}>
        <div
          className={`${getHeight()} rounded-full transition-all duration-500 ease-out shadow-sm ${getColor()}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
