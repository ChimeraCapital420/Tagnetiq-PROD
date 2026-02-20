// FILE: src/features/boardroom/layouts/DesktopLayout.tsx
// Desktop Layout — 3-column: Sidebar | Main Content | Detail Panel
//
// Sprint 7: Full-width layout for screens >= 768px.
// Left: Member list + meeting history
// Center: Active panel (chat, tasks, briefing, etc.)
// Right: Context panel (member profile, execution queue, standups)

import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOBILE_NAV_ITEMS } from '../constants';
import type { BoardroomLayoutProps } from './types';

// Existing components
import { ChatArea } from '../components/ChatArea';
import { BoardSidebar } from '../components/BoardSidebar';
import { DailyBriefing } from '../components/DailyBriefing';
import { QuickTasks } from '../components/QuickTasks';
import { NewMeetingDialog } from '../components/NewMeetingDialog';

// ============================================================================
// DESKTOP LAYOUT
// ============================================================================

export const DesktopLayout: React.FC<BoardroomLayoutProps> = (props) => {
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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Executive Boardroom</h1>
            <p className="text-xs text-muted-foreground">
              {members.length} members · {stats?.active_meetings || 0} active
              {execution?.pending_approvals ? ` · ${execution.pending_approvals} pending` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab switcher for center panel */}
          <div className="flex bg-muted rounded-lg p-0.5">
            {MOBILE_NAV_ITEMS.filter(t => t.id !== 'more').map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    activeTab === item.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <Button variant="ghost" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setNewMeetingOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Meeting
          </Button>
        </div>
      </header>

      {/* ── Main Content Area ────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Members + Meetings */}
        <aside className="w-72 flex-shrink-0 border-r overflow-hidden">
          <BoardSidebar
            members={members}
            meetings={meetings}
            activeMeetingId={activeMeeting?.id}
            onSelectMeeting={onSelectMeeting}
            activeMemberId={selectedMemberSlug}
            onSelectMember={setSelectedMemberSlug}
          />
        </aside>

        {/* Center: Active Tab Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
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
          )}

          {activeTab === 'tasks' && (
            <div className="h-full overflow-y-auto p-6">
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
            <div className="h-full overflow-y-auto p-6">
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
            <div className="h-full overflow-y-auto p-6">
              <h2 className="text-lg font-semibold mb-4">Execution Gateway</h2>

              {execution ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Status cards */}
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs text-muted-foreground">Pending Approvals</p>
                    <p className="text-2xl font-bold mt-1">{execution.pending_approvals}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs text-muted-foreground">Recent Executions</p>
                    <p className="text-2xl font-bold mt-1">{execution.recent_executions.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs text-muted-foreground">Autonomy</p>
                    <p className="text-2xl font-bold mt-1">
                      {execution.autonomy?.kill_switch ? '🛑 Killed' :
                       execution.autonomy?.enabled ? (execution.autonomy.sandbox ? '🧪 Sandbox' : '✅ Live') :
                       '⏸ Disabled'}
                    </p>
                  </div>

                  {/* Spend tracker */}
                  {execution.autonomy?.enabled && (
                    <div className="rounded-lg bg-muted p-4 md:col-span-2">
                      <p className="text-xs text-muted-foreground mb-2">Spend Tracking</p>
                      <div className="flex gap-6">
                        <div>
                          <p className="text-sm">Today: ${execution.autonomy.spent_today} / ${execution.autonomy.daily_limit}</p>
                          <div className="w-full bg-background rounded-full h-1.5 mt-1">
                            <div
                              className="bg-primary rounded-full h-1.5 transition-all"
                              style={{ width: `${Math.min(100, (execution.autonomy.spent_today / Math.max(1, execution.autonomy.daily_limit)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm">Month: ${execution.autonomy.spent_this_month} / ${execution.autonomy.monthly_limit}</p>
                          <div className="w-full bg-background rounded-full h-1.5 mt-1">
                            <div
                              className="bg-primary rounded-full h-1.5 transition-all"
                              style={{ width: `${Math.min(100, (execution.autonomy.spent_this_month / Math.max(1, execution.autonomy.monthly_limit)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent activity */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent Activity</h3>
                    <div className="space-y-2">
                      {execution.recent_executions.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ex.title}</p>
                            <p className="text-xs text-muted-foreground">{ex.member_slug} · {ex.action_type}</p>
                          </div>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2',
                            ex.status === 'executed' ? 'bg-green-500/20 text-green-400' :
                            ex.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          )}>
                            {ex.status}
                          </span>
                        </div>
                      ))}
                      {execution.recent_executions.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          No actions yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Loading execution data...</p>
              )}
            </div>
          )}
        </main>
      </div>

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