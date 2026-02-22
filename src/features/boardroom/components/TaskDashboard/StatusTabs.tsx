// FILE: src/features/boardroom/components/TaskDashboard/StatusTabs.tsx
// ═══════════════════════════════════════════════════════════════════════
// STATUS FILTER TABS — Horizontal scrollable filter pills
// ═══════════════════════════════════════════════════════════════════════

import React from 'react';
import { STATUS_TABS } from './constants';
import type { TaskStatus } from './types';

interface StatusTabsProps {
  active: TaskStatus | 'all';
  counts: Record<string, number>;
  onSelect: (filter: TaskStatus | 'all') => void;
}

export const StatusTabs: React.FC<StatusTabsProps> = ({ active, counts, onSelect }) => (
  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
    {STATUS_TABS.map((tab) => {
      const count = tab.id === 'all'
        ? Object.values(counts).reduce((s, c) => s + c, 0)
        : (counts[tab.id] || 0);

      return (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
            whitespace-nowrap transition-all shrink-0
            ${active === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }
          `}
        >
          {tab.icon}
          {tab.label}
          {count > 0 && (
            <span className={`
              text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center
              ${active === tab.id ? 'bg-primary-foreground/20' : 'bg-background'}
            `}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);