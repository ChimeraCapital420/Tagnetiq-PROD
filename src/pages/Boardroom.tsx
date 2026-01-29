// FILE: src/pages/Boardroom.tsx
// Executive Boardroom - Private AI Board of Directors with Tasks, Briefings, and Voice

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Send, Loader2, Plus, Users, User, MessageSquare, 
  History, Brain, Vote, Swords, Lock, ChevronRight,
  Sparkles, AlertCircle, Sun, FileText, Volume2,
  ChevronDown, ChevronUp, Briefcase, RefreshCw, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// INTERFACES
// ============================================================================

interface BoardMember {
  id: string;
  slug: string;
  name: string;
  role: string;
  title: string;
  ai_provider: string;
  avatar_url: string;
  personality: any;
  expertise: string[];
  voice_style: string;
  display_order: number;
  capabilities?: { name: string; description: string; autonomous: boolean }[];
  workload?: { pending: number; completed: number };
}

interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  status: string;
  started_at: string;
  concluded_at?: string;
  participants?: string[];
}

interface Message {
  id: string;
  sender_type: 'user' | 'board_member';
  member_slug?: string;
  content: string;
  created_at: string;
  ai_provider?: string;
}

interface BoardResponse {
  member: {
    slug: string;
    name: string;
    title: string;
    avatar_url: string;
    ai_provider?: string;
  };
  content: string;
  error?: boolean;
}

interface BriefingSection {
  member_slug: string;
  member_name: string;
  title: string;
  content: string;
  priority: number;
}

interface Briefing {
  id: string;
  briefing_date: string;
  briefing_type: string;
  sections: BriefingSection[];
  summary: string;
  action_items: any[];
  read_at: string | null;
  created_at: string;
}

interface DashboardStats {
  total_members: number;
  active_meetings: number;
  pending_tasks: number;
  tasks_completed_this_week: number;
  has_unread_briefing: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MEETING_TYPES = [
  { id: 'full_board', name: 'Full Board Meeting', icon: Users, description: 'All members respond to your question' },
  { id: 'one_on_one', name: '1:1 Executive Session', icon: User, description: 'Private meeting with one board member' },
  { id: 'committee', name: 'Committee Meeting', icon: MessageSquare, description: 'Select 2-4 members for focused discussion' },
  { id: 'vote', name: 'Board Vote', icon: Vote, description: 'Get approve/reject/abstain from all members' },
  { id: 'devils_advocate', name: "Devil's Advocate", icon: Swords, description: 'One member argues against your proposal' },
];

const AI_PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-500/20 text-orange-400',
  openai: 'bg-green-500/20 text-green-400',
  groq: 'bg-blue-500/20 text-blue-400',
  gemini: 'bg-purple-500/20 text-purple-400',
  google: 'bg-purple-500/20 text-purple-400',
  xai: 'bg-red-500/20 text-red-400',
  perplexity: 'bg-cyan-500/20 text-cyan-400',
  deepseek: 'bg-indigo-500/20 text-indigo-400',
  mistral: 'bg-yellow-500/20 text-yellow-400',
};

const QUICK_TASKS = [
  { id: 'social-posts', label: 'Social Posts', assignedTo: 'glitch', taskType: 'social_media_posts' },
  { id: 'competitor-analysis', label: 'Competitor Intel', assignedTo: 'athena', taskType: 'competitive_analysis' },
  { id: 'market-research', label: 'Market Research', assignedTo: 'scuba', taskType: 'market_research' },
  { id: 'investor-narrative', label: 'Investor Pitch', assignedTo: 'athena', taskType: 'investor_narrative' },
  { id: 'terms-of-service', label: 'Terms of Service', assignedTo: 'lexicoda', taskType: 'terms_of_service' },
  { id: 'privacy-policy', label: 'Privacy Policy', assignedTo: 'lexicoda', taskType: 'privacy_policy' },
  { id: 'financial-projections', label: 'Financials', assignedTo: 'griffin', taskType: 'financial_projections' },
  { id: 'api-design', label: 'API Design', assignedTo: 'vulcan', taskType: 'api_design' },
];

// ============================================================================
// VOICE PLAYER COMPONENT (inline for simplicity)
// ============================================================================

const VoiceButton: React.FC<{ text: string; memberSlug: string; memberName: string }> = ({ 
  text, memberSlug, memberName 
}) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playVoice = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/boardroom/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text, member_slug: memberSlug }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Convert base64 to audio
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
      }

      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.play();
      setPlaying(true);
    } catch (err: any) {
      toast.error(err.message || 'Voice playback failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={playVoice}
      disabled={loading}
      title={`Listen to ${memberName}`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Volume2 className={cn("h-3 w-3", playing && "text-primary")} />
      )}
    </Button>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BoardroomPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Core state
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newMeetingType, setNewMeetingType] = useState('full_board');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [taskLoading, setTaskLoading] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<{ id: string; content: string; member: string }[]>([]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkAccessAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setHasAccess(false);
        return;
      }

      const response = await fetch('/api/boardroom', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.status === 403) {
        setHasAccess(false);
        return;
      }

      if (!response.ok) throw new Error('Failed to load boardroom');

      const data = await response.json();
      setHasAccess(true);
      setMembers(data.members || []);
      setMeetings(data.meetings || []);
      setStats(data.stats || null);

      // Check for today's briefing
      if (data.todays_briefing) {
        setBriefing(data.todays_briefing);
      }
    } catch (error) {
      console.error('Boardroom load error:', error);
      setHasAccess(false);
    }
  };

  // ============================================================================
  // BRIEFING FUNCTIONS
  // ============================================================================

  const generateBriefing = async () => {
    setBriefingLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/boardroom/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'morning' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setBriefing(data);
      toast.success('Briefing generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate briefing');
    } finally {
      setBriefingLoading(false);
    }
  };

  const fetchBriefing = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/boardroom/briefing', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      const data = await response.json();
      if (data.id) {
        setBriefing(data);
      }
    } catch (err) {
      console.error('Failed to fetch briefing:', err);
    }
  };

  // ============================================================================
  // TASK FUNCTIONS
  // ============================================================================

  const executeTask = async (task: typeof QUICK_TASKS[0]) => {
    setTaskLoading(task.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/boardroom/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assigned_to: task.assignedTo,
          title: task.label,
          task_type: task.taskType,
          execute_now: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTaskResults(prev => [{
        id: task.id,
        content: data.deliverable,
        member: data.member?.name || task.assignedTo,
      }, ...prev]);

      toast.success(`${task.label} completed!`);
    } catch (err: any) {
      toast.error(err.message || 'Task failed');
    } finally {
      setTaskLoading(null);
    }
  };

  // ============================================================================
  // MEETING FUNCTIONS
  // ============================================================================

  const createMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    if (newMeetingType === 'one_on_one' && selectedMembers.length !== 1) {
      toast.error('Select exactly one member for 1:1 meeting');
      return;
    }

    if (newMeetingType === 'committee' && (selectedMembers.length < 2 || selectedMembers.length > 4)) {
      toast.error('Select 2-4 members for committee meeting');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const participants = ['one_on_one', 'committee', 'devils_advocate'].includes(newMeetingType)
        ? selectedMembers.map(slug => members.find(m => m.slug === slug)?.id).filter(Boolean)
        : null;

      const response = await fetch('/api/boardroom/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newMeetingTitle,
          meeting_type: newMeetingType,
          participants,
        }),
      });

      if (!response.ok) throw new Error('Failed to create meeting');

      const meeting = await response.json();
      setMeetings(prev => [meeting, ...prev]);
      setActiveMeeting(meeting);
      setMessages([]);
      setNewMeetingOpen(false);
      setNewMeetingTitle('');
      setSelectedMembers([]);
      toast.success('Meeting started!');
    } catch (error) {
      toast.error('Failed to create meeting');
    }
  };

  const loadMeeting = async (meeting: Meeting) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/boardroom/meetings?id=${meeting.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to load meeting');

      const data = await response.json();
      setActiveMeeting(data);
      setMessages(data.messages || []);
    } catch (error) {
      toast.error('Failed to load meeting');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeMeeting || sending) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');

    let respondingMembers: string[] = [];
    if (activeMeeting.meeting_type === 'full_board' || activeMeeting.meeting_type === 'vote') {
      respondingMembers = members.map(m => m.slug);
    } else if (activeMeeting.participants) {
      const participantMembers = members.filter(m => 
        activeMeeting.participants?.includes(m.id)
      );
      respondingMembers = participantMembers.map(m => m.slug);
    } else {
      respondingMembers = members.map(m => m.slug);
    }

    setLoadingResponses(respondingMembers);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_type: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_id: activeMeeting.id,
          message: messageText,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        const newMessages: Message[] = [
          { ...data.user_message, sender_type: 'user' },
          ...data.responses.map((r: BoardResponse) => ({
            id: `response-${r.member.slug}-${Date.now()}`,
            sender_type: 'board_member' as const,
            member_slug: r.member.slug,
            content: r.content,
            created_at: new Date().toISOString(),
            ai_provider: r.member.ai_provider,
          })),
        ];
        return [...filtered, ...newMessages];
      });

    } catch (error) {
      toast.error('Failed to get board response');
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      setNewMessage(messageText);
    } finally {
      setSending(false);
      setLoadingResponses([]);
    }
  };

  const getMemberBySlug = (slug: string) => members.find(m => m.slug === slug);

  // ============================================================================
  // RENDER - ACCESS DENIED
  // ============================================================================

  if (hasAccess === false) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-2xl">
        <Card className="border-destructive/50">
          <CardContent className="p-12 text-center">
            <Lock className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground mb-6">
              The Executive Boardroom is a private feature available only to authorized users.
            </p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // RENDER - LOADING
  // ============================================================================

  if (hasAccess === null) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Executive Boardroom
          </h1>
          <p className="text-muted-foreground mt-1">Your AI Board of Directors</p>
        </div>
        <Dialog open={newMeetingOpen} onOpenChange={setNewMeetingOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start New Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Meeting Title</label>
                <Input
                  placeholder="e.g., Q1 Strategy Review, Product Launch Discussion..."
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Meeting Type</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MEETING_TYPES.map((type) => (
                    <Card
                      key={type.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        newMeetingType === type.id && "border-primary bg-primary/5"
                      )}
                      onClick={() => {
                        setNewMeetingType(type.id);
                        setSelectedMembers([]);
                      }}
                    >
                      <CardContent className="p-4 flex items-start gap-3">
                        <type.icon className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">{type.name}</p>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {['one_on_one', 'committee', 'devils_advocate'].includes(newMeetingType) && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Member{newMeetingType === 'one_on_one' ? '' : 's'}
                    {newMeetingType === 'committee' && ' (2-4)'}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {members.map((member) => (
                      <Card
                        key={member.slug}
                        className={cn(
                          "cursor-pointer transition-all hover:border-primary p-2",
                          selectedMembers.includes(member.slug) && "border-primary bg-primary/5"
                        )}
                        onClick={() => {
                          if (newMeetingType === 'one_on_one') {
                            setSelectedMembers([member.slug]);
                          } else {
                            setSelectedMembers(prev =>
                              prev.includes(member.slug)
                                ? prev.filter(s => s !== member.slug)
                                : [...prev, member.slug]
                            );
                          }
                        }}
                      >
                        <div className="flex flex-col items-center text-center">
                          <Avatar className="h-12 w-12 mb-1">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.name[0]}</AvatarFallback>
                          </Avatar>
                          <p className="text-xs font-medium truncate w-full">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground">{member.title}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={createMeeting} className="w-full">
                Start Meeting
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ================================================================== */}
      {/* DAILY BRIEFING SECTION */}
      {/* ================================================================== */}
      <Collapsible open={briefingExpanded} onOpenChange={setBriefingExpanded} className="mb-6">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sun className="h-5 w-5 text-yellow-500" />
                  <div>
                    <CardTitle className="text-lg">Daily Briefing</CardTitle>
                    <CardDescription>
                      {briefing 
                        ? `Generated ${new Date(briefing.created_at).toLocaleTimeString()}`
                        : 'Your board is ready to brief you'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!briefing && (
                    <Button 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); generateBriefing(); }}
                      disabled={briefingLoading}
                    >
                      {briefingLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Generate Briefing
                    </Button>
                  )}
                  {briefingExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {briefingLoading ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">
                    Scuba Steve is scanning market news, Athena is analyzing strategy...
                  </p>
                </div>
              ) : briefing ? (
                <div className="space-y-4">
                  {/* Executive Summary */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          Executive Summary
                        </h4>
                        <p className="text-amber-800 dark:text-amber-200 text-sm">
                          {briefing.summary}
                        </p>
                      </div>
                      <VoiceButton text={briefing.summary} memberSlug="griffin" memberName="Griffin" />
                    </div>
                  </div>

                  {/* Sections */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {briefing.sections.map((section, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{section.title}</span>
                            <Badge variant="outline" className="text-xs">{section.member_name}</Badge>
                          </div>
                          <VoiceButton 
                            text={section.content} 
                            memberSlug={section.member_slug} 
                            memberName={section.member_name} 
                          />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-4">{section.content}</p>
                      </Card>
                    ))}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateBriefing}
                    disabled={briefingLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Briefing
                  </Button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Sun className="h-12 w-12 text-yellow-500/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No briefing yet today. Click above to have your board prepare one.
                  </p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ================================================================== */}
      {/* QUICK TASKS SECTION */}
      {/* ================================================================== */}
      <Collapsible open={tasksExpanded} onOpenChange={setTasksExpanded} className="mb-6">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle className="text-lg">Quick Tasks</CardTitle>
                    <CardDescription>Assign work to board members with one click</CardDescription>
                  </div>
                </div>
                {tasksExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_TASKS.map((task) => {
                  const member = getMemberBySlug(task.assignedTo);
                  const isLoading = taskLoading === task.id;
                  const hasResult = taskResults.some(r => r.id === task.id);

                  return (
                    <Button
                      key={task.id}
                      variant={hasResult ? "secondary" : "outline"}
                      size="sm"
                      disabled={isLoading}
                      onClick={() => executeTask(task)}
                      className="h-auto py-2 px-3"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : hasResult ? (
                        <FileText className="h-3 w-3 mr-2 text-green-500" />
                      ) : (
                        <FileText className="h-3 w-3 mr-2" />
                      )}
                      <span>{task.label}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {member?.name || task.assignedTo}
                      </Badge>
                    </Button>
                  );
                })}
              </div>

              {/* Task Results */}
              {taskResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Completed Deliverables</h4>
                  {taskResults.map((result, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">{result.member}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(result.content)}
                        >
                          Copy
                        </Button>
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                        {result.content}
                      </pre>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ================================================================== */}
      {/* MAIN GRID - SIDEBAR + CHAT */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Tabs defaultValue="board">
            <TabsList className="w-full">
              <TabsTrigger value="board" className="flex-1">Board</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="mt-4">
              <ScrollArea className="h-[50vh]">
                <div className="space-y-2 pr-2">
                  {members.map((member) => (
                    <Card key={member.slug} className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback>{member.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.title}</p>
                        </div>
                        <Badge className={cn("text-[10px]", AI_PROVIDER_COLORS[member.ai_provider])}>
                          {member.ai_provider}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[50vh]">
                <div className="space-y-2 pr-2">
                  {meetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No meetings yet</p>
                  ) : (
                    meetings.map((meeting) => (
                      <Card
                        key={meeting.id}
                        className={cn(
                          "p-3 cursor-pointer hover:border-primary transition-all",
                          activeMeeting?.id === meeting.id && "border-primary"
                        )}
                        onClick={() => loadMeeting(meeting)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{meeting.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(meeting.started_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={meeting.status === 'active' ? 'default' : 'secondary'}>
                            {meeting.status}
                          </Badge>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          <Card className="h-[60vh] flex flex-col">
            {activeMeeting ? (
              <>
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{activeMeeting.title}</h2>
                    <p className="text-sm text-muted-foreground capitalize">
                      {activeMeeting.meeting_type.replace('_', ' ')}
                    </p>
                  </div>
                  <Badge variant={activeMeeting.status === 'active' ? 'default' : 'secondary'}>
                    {activeMeeting.status}
                  </Badge>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isUser = msg.sender_type === 'user';
                      const member = msg.member_slug ? getMemberBySlug(msg.member_slug) : null;

                      return (
                        <div key={msg.id} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                          {!isUser && member && (
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={member.avatar_url} />
                              <AvatarFallback>{member.name[0]}</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn("max-w-[80%]", isUser && "text-right")}>
                            {!isUser && member && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{member.name}</span>
                                <Badge className={cn("text-[10px]", AI_PROVIDER_COLORS[msg.ai_provider || member.ai_provider])}>
                                  {msg.ai_provider || member.ai_provider}
                                </Badge>
                                {/* VOICE BUTTON */}
                                <VoiceButton 
                                  text={msg.content} 
                                  memberSlug={member.slug} 
                                  memberName={member.name} 
                                />
                              </div>
                            )}
                            <div className={cn(
                              "rounded-lg px-4 py-2 inline-block text-left",
                              isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {loadingResponses.map((slug) => {
                      const member = getMemberBySlug(slug);
                      if (!member) return null;
                      return (
                        <div key={`loading-${slug}`} className="flex gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium mb-1">{member.name}</p>
                            <div className="bg-muted rounded-lg px-4 py-2 inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Thinking...</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {activeMeeting.status === 'active' && (
                  <div className="p-4 border-t">
                    <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Address the board..."
                        disabled={sending}
                        className="flex-1 min-h-[44px] max-h-32 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button type="submit" disabled={sending || !newMessage.trim()}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">Welcome to the Boardroom</p>
                  <p className="text-sm mb-4">Start a new meeting or select one from history</p>
                  <Button onClick={() => setNewMeetingOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start Meeting
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BoardroomPage;