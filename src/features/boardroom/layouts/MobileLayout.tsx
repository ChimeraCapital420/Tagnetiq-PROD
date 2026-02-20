// FILE: src/features/boardroom/layouts/MobileLayout.tsx
// Mobile Layout — Bottom navigation with full-screen panels
//
// Sprint 7: The CEO runs the company from their phone.
// Bottom nav: Chat | Tasks | Brief | Execute | More
// Each tab renders a full-screen panel. Badges show counts.

import React from 'react';
import { cn } from '@/lib/utils';
import { MOBILE_NAV_ITEMS, UI_CONFIG } from '../constants';
import type { BoardroomLayoutProps } from './types';

// Lazy panel imports — only the active panel renders
import { ChatArea } from '../components/ChatArea';
import { BoardSidebar } from '../components/BoardSidebar';
import { DailyBriefing } from '../components/DailyBriefing';
import { QuickTasks } from '../components/QuickTasks';
import { NewMeetingDialog } from '../components/NewMeetingDialog';

// ============================================================================
// MOBILE LAYOUT
// ============================================================================

export const MobileLayout: React.FC<BoardroomLayoutProps> = (props) => {
  const {
    members, meetings, stats, execution, briefing,
    taskResults, loadingTaskId,
    activeMeeting, messages, sending, loadingResponses, newMessage,
    activeTab, selectedMemberSlug, newMeetingOpen,
    setActiveTab, setSelectedMemberSlug, setNewMeetingOpen,
    onNewMessageChange, onSendMessage, onSelectMeeting,
    onCreateMeeting, onExecuteTask, onGenerateBriefing,
    onRefresh, getMemberBySlug,
  } = props;

  // Badge counts for bottom nav
  const badgeCounts: Record<string, number> = {
    pending_approvals: execution?.pending_approvals || 0,
    unread_briefing: (briefing && !briefing.read_at) ? 1 : 0,
    pending_tasks: stats?.pending_tasks || 0,
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Active Panel (full screen minus nav) ─────────── */}
      <div
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: UI_CONFIG.bottomNavHeight }}
      >
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Member selector strip */}
            {!activeMeeting && (
              <div className="flex-shrink-0 border-b px-3 py-2">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {members.map((m) => (
                    <button
                      key={m.slug}
                      onClick={() => setSelectedMemberSlug(m.slug)}
                      className={cn(
                        'flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        selectedMemberSlug === m.slug
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      <img
                        src={m.avatar_url}
                        alt={m.name}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {m.name.split(' ')[0]}
                    </button>
                  ))}
                  <button
                    onClick={() => setNewMeetingOpen(true)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    @all
                  </button>
                </div>
              </div>
            )}

            {/* Chat content */}
            <div className="flex-1 overflow-hidden">
              <ChatArea
                activeMeeting={activeMeeting}
                messages={messages}
                loadingResponses={loadingResponses}
                sending={sending}
                newMessage={newMessage}
                onNewMessageChange={onNewMessageChange}
                onSendMessage={onSendMessage}
                onStartMeeting={() => setNewMeetingOpen(true)}
                getMemberBySlug={getMemberBySlug}
              />
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="h-full overflow-y-auto p-4">
            <h2 className="text-lg font-semibold mb-4">Tasks</h2>
            <QuickTasks
              members={members}
              taskResults={taskResults}
              loadingTaskId={loadingTaskId}
              expanded={true}
              onExpandedChange={() => {}}
              onExecuteTask={onExecuteTask}
              getMemberBySlug={getMemberBySlug}
            />
          </div>
        )}

        {activeTab === 'briefing' && (
          <div className="h-full overflow-y-auto p-4">
            <DailyBriefing
              briefing={briefing}
              isLoading={false}
              expanded={true}
              onExpandedChange={() => {}}
              onGenerateBriefing={onGenerateBriefing}
            />
          </div>
        )}

        {activeTab === 'execute' && (
          <div className="h-full overflow-y-auto p-4">
            <h2 className="text-lg font-semibold mb-2">Execution Queue</h2>
            {execution && (
              <div className="space-y-3">
                {/* Kill switch banner */}
                {execution.autonomy?.kill_switch && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                    <p className="text-sm font-medium text-red-400">
                      Kill switch active — all autonomy stopped
                    </p>
                    {execution.autonomy.kill_reason && (
                      <p className="text-xs text-red-400/70 mt-1">{execution.autonomy.kill_reason}</p>
                    )}
                  </div>
                )}

                {/* Pending count */}
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pending approvals</span>
                    <span className="font-semibold">{execution.pending_approvals}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Recent executions</span>
                    <span className="font-semibold">{execution.recent_executions.length}</span>
                  </div>
                </div>

                {/* Autonomy spend */}
                {execution.autonomy && execution.autonomy.enabled && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Today's spend</p>
                    <p className="text-sm font-semibold">
                      ${execution.autonomy.spent_today} / ${execution.autonomy.daily_limit}
                    </p>
                  </div>
                )}

                {/* Recent executions list */}
                {execution.recent_executions.map((ex) => (
                  <div key={ex.id} className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{ex.title}</span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        ex.status === 'executed' ? 'bg-green-500/20 text-green-400' :
                        ex.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      )}>
                        {ex.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ex.member_slug} · {ex.action_type}
                    </p>
                  </div>
                ))}

                {execution.recent_executions.length === 0 && execution.pending_approvals === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No actions yet. The board will propose actions as trust builds.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'more' && (
          <div className="h-full overflow-y-auto p-4">
            <h2 className="text-lg font-semibold mb-4">Board</h2>

            {/* Member list */}
            <div className="space-y-2 mb-6">
              {members.map((m) => (
                <button
                  key={m.slug}
                  onClick={() => setSelectedMemberSlug(m.slug)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-left"
                >
                  <img
                    src={m.avatar_url}
                    alt={m.name}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.title}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.ai_provider}</span>
                </button>
              ))}
            </div>

            {/* Recent meetings */}
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent Meetings</h3>
            <div className="space-y-2">
              {meetings.slice(0, 5).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectMeeting(m)}
                  className="w-full text-left p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.meeting_type.replace('_', ' ')} · {m.status}
                  </p>
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="mt-6 w-full p-3 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              Refresh Dashboard
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t z-50 safe-area-pb"
        style={{ height: UI_CONFIG.bottomNavHeight }}
      >
        <div className="flex items-center justify-around h-full px-2">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount = item.badge ? badgeCounts[item.badge] || 0 : 0;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Dialogs ──────────────────────────────────────── */}
      <NewMeetingDialog
        open={newMeetingOpen}
        onOpenChange={setNewMeetingOpen}
        members={members}
        onCreateMeeting={onCreateMeeting}
      />
    </div>
  );
};