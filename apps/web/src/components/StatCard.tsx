import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
}) => {
  const getColorStyles = () => {
    switch (color) {
      case 'emerald':
        return {
          iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accent: 'text-emerald-400',
        };
      case 'violet':
        return {
          iconBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
          accent: 'text-violet-400',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          accent: 'text-amber-400',
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          accent: 'text-rose-400',
        };
      case 'blue':
      default:
        return {
          iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          accent: 'text-blue-400',
        };
    }
  };

  const { iconBg } = getColorStyles();

  return (
    <div className="glass-card rounded-xl p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className={`p-2.5 rounded-lg border ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
        {trend && <span className="text-xs font-semibold text-emerald-400">{trend}</span>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
};
