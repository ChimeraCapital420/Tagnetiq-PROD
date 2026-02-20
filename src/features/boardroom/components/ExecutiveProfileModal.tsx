// FILE: src/features/boardroom/components/ExecutiveProfileModal.tsx
// Modal showing board member details, projects, and voice chat activation
//
// Sprint 8 fix: Aligned ALL property accesses to BoardMember type
//   - member.avatar_url (not .avatar)
//   - member.expertise (not .specialties)
//   - member.slug for bio lookup (not .id which is a UUID)
//   - member.slug passed to action handlers
//   - Removed member.status (doesn't exist on type)
//   - Bios keyed by slug for all 15 members

import React, { useState } from 'react';
import {
  X,
  Phone,
  Briefcase,
  GraduationCap,
  Target,
  MessageSquare,
  Volume2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BoardMember } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ExecutiveProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: BoardMember | null;
  onStartVoiceChat: (memberId: string) => void;
  onStartTextChat: (memberId: string) => void;
  onUpdateSettings: (memberId: string, settings: MemberSettings) => void;
}

interface MemberSettings {
  voiceEnabled: boolean;
  voiceSpeed: number;
  voicePitch: number;
  avatarStyle: 'professional' | 'casual' | 'artistic';
  notificationsEnabled: boolean;
}

// =============================================================================
// EXECUTIVE BIOS — keyed by member SLUG (matches boardroom_members.slug)
// =============================================================================

interface ExecutiveBio {
  background: string;
  education: string[];
  philosophy: string;
  currentFocus: string[];
  funFact: string;
}

const EXECUTIVE_BIOS: Record<string, ExecutiveBio> = {
  // 1. Athena — Chief Strategy Officer
  athena: {
    background: "Former McKinsey partner specializing in retail disruption. Advised Fortune 500 companies on digital transformation. Expert in competitive analysis, market entry strategy, and strategic pivots.",
    education: ["MBA, Stanford GSB", "Rhodes Scholar, Oxford", "BS Economics, Wharton"],
    philosophy: "The resale market rewards those who see trends before they become obvious. Data is your crystal ball, but intuition is your compass.",
    currentFocus: ["Competitive Positioning", "Market Expansion Playbook", "Strategic OKR Architecture"],
    funFact: "Predicted the vintage Pyrex boom 18 months before it happened using only thrift store data.",
  },

  // 2. Griffin — Chief Financial Officer
  griffin: {
    background: "Former investment banker at Goldman Sachs, specialized in consumer retail. CPA with expertise in inventory-based businesses. Built financial models for over $2B in retail transactions.",
    education: ["MBA Finance, Columbia", "CPA, New York", "BS Accounting, Notre Dame"],
    philosophy: "Profit isn't just about selling high — it's about buying smart, holding right, and knowing when to move. Every dollar is a soldier.",
    currentFocus: ["Unit Economics Optimization", "Cash Flow Runway Extension", "Capital Allocation Strategy"],
    funFact: "Can calculate ROI on any item within 3 seconds of seeing it.",
  },

  // 3. Scuba Steve — Chief Research Officer
  scuba: {
    background: "Data scientist who built pricing algorithms for major e-commerce platforms. Goes 10 layers deep where others stop at 1. Expert in market dynamics, competitive intelligence, and contrarian analysis.",
    education: ["PhD Economics, Chicago", "MS Statistics, Stanford"],
    philosophy: "The best insights are hiding at the bottom of the data ocean. Everyone skims the surface — we dive.",
    currentFocus: ["Market Trend Deep Dives", "Contrarian Signal Detection", "Competitive Intelligence Synthesis"],
    funFact: "Built a model that predicts eBay final prices within 5% accuracy across 40 categories.",
  },

  // 4. Glitch — Chief Marketing Officer
  glitch: {
    background: "Built marketing departments at three unicorn startups. Pioneer of influencer partnerships in the resale space. Expert in viral mechanics, community building, and identity-based marketing.",
    education: ["BA Marketing, NYU Stern", "Google Analytics Certified", "Self-taught meme economist"],
    philosophy: "In resale, your reputation IS your brand. Every listing is a chance to tell your story. Think in hooks, not features.",
    currentFocus: ["Viral Growth Mechanics", "Community-Led Acquisition", "Multi-Platform Brand Strategy"],
    funFact: "Viral tweet about a $2 thrift find that sold for $800 got 2M impressions overnight.",
  },

  // 5. Vulcan — Chief Technology Officer
  vulcan: {
    background: "Former principal engineer at Stripe and early AWS architect. Built distributed systems handling millions of transactions. Expert in scalable architecture, API design, and developer experience.",
    education: ["MS Computer Science, Carnegie Mellon", "BS Engineering, Georgia Tech"],
    philosophy: "Architecture is destiny. Build the right foundation and the product builds itself. Cut complexity before adding features.",
    currentFocus: ["Platform Scalability", "AI Integration Pipeline", "Developer Experience Optimization"],
    funFact: "Wrote a pricing engine in a weekend that outperformed a team of 12 working for 6 months.",
  },

  // 6. Lexicoda — Chief Legal Officer
  lexicoda: {
    background: "IP attorney with 20 years experience in consumer products. Former general counsel for major auction house. Expert in authenticity verification, platform compliance, and seller protection.",
    education: ["JD, Yale Law School", "BA Philosophy, Princeton"],
    philosophy: "In resale, trust is everything. One fake item can destroy years of reputation building. Compliance isn't a constraint — it's a competitive advantage.",
    currentFocus: ["Authentication Protocol Design", "Platform Policy Compliance", "Seller Legal Protection Framework"],
    funFact: "Successfully defended a client's right to resell limited edition sneakers against Nike's legal team.",
  },

  // 7. SHA-1 — Chief Partnerships Officer
  sha1: {
    background: "Former head of business development at Shopify. Built partner ecosystems generating $500M+ in GMV. Expert in deal structuring, affiliate programs, and strategic relationship management.",
    education: ["MBA, INSEAD", "BS International Business, Georgetown"],
    philosophy: "Great partnerships multiply value for everyone. The best deals are the ones where both sides feel like they won.",
    currentFocus: ["Platform Partnership Expansion", "Affiliate Revenue Optimization", "Strategic Integration Planning"],
    funFact: "Closed a partnership deal on a napkin at a conference that became a $10M revenue stream.",
  },

  // 8. LEO — Chief Innovation Officer
  leo: {
    background: "Serial inventor with 12 patents in AI and computer vision. Former research lead at Google X. Expert in emerging technologies, rapid prototyping, and turning moonshots into products.",
    education: ["PhD AI/ML, MIT", "MS Robotics, ETH Zurich"],
    philosophy: "Innovation isn't about being first — it's about being right. Prototype fast, fail cheap, scale what works.",
    currentFocus: ["AI-Powered Product Identification", "Computer Vision for Condition Grading", "Next-Gen Scanning Technology"],
    funFact: "Built an AI that identifies counterfeit handbags with 97% accuracy from a single photo.",
  },

  // 9. Cerebro — Chief People Officer
  cerebro: {
    background: "Former VP People at Netflix during hypergrowth. Organizational psychologist specializing in high-performance team dynamics. Expert in talent networks, culture design, and community building.",
    education: ["PhD Organizational Psychology, Columbia", "MS I/O Psychology, Michigan"],
    philosophy: "The right person in the right role with the right support is unstoppable. Build for people, not positions.",
    currentFocus: ["Community Network Mapping", "Talent Development Programs", "Culture and Engagement Systems"],
    funFact: "Can predict team performance with 85% accuracy just from meeting dynamics.",
  },

  // 10. Aegle — Chief Wellness Officer
  aegle: {
    background: "Integrative medicine practitioner who pivoted to business health diagnostics. Former wellness director for Fortune 100 companies. Treats organizations like living organisms — diagnoses issues before they become crises.",
    education: ["MD, Johns Hopkins", "MBA Health Management, Wharton"],
    philosophy: "A business that burns out its founder is a business on borrowed time. Sustainable growth beats fast growth every time.",
    currentFocus: ["Founder Burnout Prevention", "Business Health Diagnostics", "Sustainable Growth Metrics"],
    funFact: "Developed a 'business vital signs' framework now used by 200+ startups.",
  },

  // 11. Janus — Chief Intelligence Officer
  janus: {
    background: "Former intelligence analyst turned market strategist. Sees both past and future simultaneously. Expert in historical pattern analysis, scenario planning, and signal-vs-noise filtering.",
    education: ["MA History, Oxford", "MS Futures Studies, University of Houston"],
    philosophy: "History doesn't repeat, but it rhymes. The future whispers — learn to listen to both echoes and whispers.",
    currentFocus: ["Historical Pattern Matching", "Scenario Planning Simulations", "Trend Timing Optimization"],
    funFact: "Predicted three of the last five market crashes using 200-year-old economic patterns.",
  },

  // 12. Legolas — Chief Product Analyst
  legolas: {
    background: "Former senior appraiser at Christie's auction house. Encyclopedic knowledge of collectibles, toys, and consumer products. Every detail matters — from mold variations to packaging dates.",
    education: ["MA Art History, Sotheby's Institute", "Certified Appraiser, ASA"],
    philosophy: "Every product tells a story, and every detail matters. The difference between $5 and $5,000 is often one digit on a date stamp.",
    currentFocus: ["Product Authentication Systems", "Rarity and Demand Forecasting", "Condition Grading Standards"],
    funFact: "Identified a $40,000 prototype Hot Wheels at a flea market by a 0.5mm mold difference.",
  },

  // 13. Orion — Chief Knowledge Officer
  orion: {
    background: "Former chief librarian of Congress digital archives. Built knowledge management systems for NASA and DARPA. Expert in information architecture, institutional memory, and learning system design.",
    education: ["PhD Information Science, Berkeley", "MLIS, University of Michigan"],
    philosophy: "Knowledge is power, but organized knowledge is superpower. The best system is one that makes you smarter every time you use it.",
    currentFocus: ["Institutional Knowledge Base", "Learning Path Optimization", "Documentation Best Practices"],
    funFact: "Designed a knowledge system that reduced onboarding time from 6 weeks to 4 days.",
  },

  // 14. Sal — Chief Operations Officer
  sal: {
    background: "Former Amazon logistics manager who scaled fulfillment from startup to $100M. Six Sigma Black Belt. Expert in inventory management, process automation, and operational efficiency. Every minute an item sits is money lost.",
    education: ["MS Operations Research, MIT", "Six Sigma Black Belt", "BS Industrial Engineering, Purdue"],
    philosophy: "The fastest path to profit is eliminating waste. Optimize the system, not just the parts.",
    currentFocus: ["Listing Automation Pipeline", "Shipping Cost Optimization", "Warehouse Layout Systems"],
    funFact: "Personal record: Listed 47 items in one hour with full descriptions, measurements, and photos.",
  },

  // 15. Prometheus — Chief Psychology Officer
  prometheus: {
    background: "Behavioral psychologist specializing in decision-making under uncertainty. Former professor studying cognitive biases in financial markets. Expert in the psychology of collecting, value perception, and founder mindset.",
    education: ["PhD Clinical Psychology, University of Toronto", "Postdoc Behavioral Economics, Harvard"],
    philosophy: "The market doesn't care about your feelings, but your feelings shape every decision you make. Master yourself first.",
    currentFocus: ["Founder Decision Frameworks", "Cognitive Bias Identification", "Performance Psychology Programs"],
    funFact: "Studied why people pay 10x more for 'vintage' vs 'used' — it's the same item with a different story.",
  },
};

/** Fallback bio for any member not in the map */
const DEFAULT_BIO: ExecutiveBio = {
  background: "Seasoned executive bringing deep domain expertise to the board. Committed to elevating strategic thinking and driving measurable outcomes.",
  education: ["Advanced degree in relevant field"],
  philosophy: "Excellence is not a destination — it's a daily practice.",
  currentFocus: ["Strategic Advisory", "Cross-Functional Collaboration"],
  funFact: "Joined the board because one conversation changed everything.",
};

// =============================================================================
// COMPONENT
// =============================================================================

export const ExecutiveProfileModal: React.FC<ExecutiveProfileModalProps> = ({
  isOpen,
  onClose,
  member,
  onStartVoiceChat,
  onStartTextChat,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState<MemberSettings>({
    voiceEnabled: true,
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    avatarStyle: 'professional',
    notificationsEnabled: true,
  });

  if (!member) return null;

  // Lookup bio by SLUG (matches boardroom_members.slug)
  const bio = EXECUTIVE_BIOS[member.slug] || DEFAULT_BIO;

  // Use member.expertise from DB (the actual field), with safe fallback
  const memberExpertise = member.expertise || [];

  const handleSettingChange = (key: keyof MemberSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onUpdateSettings(member.slug, newSettings);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header with Avatar */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="flex items-start gap-4">
            {/* Avatar — uses avatar_url (the actual DB field) */}
            <div className="relative">
              <div 
                className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white/20"
                style={{ 
                  backgroundImage: member.avatar_url ? `url(${member.avatar_url})` : undefined,
                  backgroundSize: 'cover',
                }}
              >
                {!member.avatar_url && member.name.split(' ').map(n => n[0]).join('')}
              </div>
              {/* Active indicator — uses is_active from DB, not .status */}
              {member.is_active !== undefined && (
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 ${
                  member.is_active ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              )}
            </div>

            {/* Name and Title */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{member.name}</h2>
              <p className="text-blue-300">{member.title || member.role}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {memberExpertise.slice(0, 3).map((skill, i) => (
                  <Badge key={i} variant="secondary" className="bg-white/10 text-white/80 text-xs">
                    {typeof skill === 'string' ? skill : String(skill)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick Actions — pass slug (handlers expect slug, not UUID) */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onStartVoiceChat(member.slug);
                  onClose();
                }}
              >
                <Phone className="w-4 h-4 mr-2" />
                Voice Chat
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onStartTextChat(member.slug);
                  onClose();
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Message
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6">
            <TabsTrigger value="profile" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Profile
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Projects
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Settings
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px]">
            {/* Profile Tab */}
            <TabsContent value="profile" className="p-6 space-y-6 mt-0">
              {/* Philosophy */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
                <p className="text-sm italic text-muted-foreground">"{bio.philosophy}"</p>
              </div>

              {/* Background */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  Background
                </h3>
                <p className="text-sm text-muted-foreground">{bio.background}</p>
              </div>

              {/* Education */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <GraduationCap className="w-4 h-4 text-green-500" />
                  Education
                </h3>
                <ul className="space-y-1">
                  {bio.education.map((edu, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <ChevronRight className="w-3 h-3" />
                      {edu}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Expertise — uses LIVE data from member, not static bio */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  Areas of Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                  {memberExpertise.map((skill, i) => (
                    <Badge key={i} variant="outline">
                      {typeof skill === 'string' ? skill : String(skill)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* AI Provider Badge */}
              {member.ai_provider && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Powered by</span>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {member.ai_provider}
                  </Badge>
                  {member.ai_model && (
                    <span className="text-[10px] opacity-60">{member.ai_model}</span>
                  )}
                </div>
              )}

              {/* Fun Fact */}
              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                <h3 className="font-semibold flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Fun Fact
                </h3>
                <p className="text-sm text-muted-foreground">{bio.funFact}</p>
              </div>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="p-6 space-y-4 mt-0">
              <h3 className="font-semibold">Current Focus Areas</h3>
              <div className="space-y-3">
                {bio.currentFocus.map((focus, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">{focus}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">Active</Badge>
                  </div>
                ))}
              </div>

              {/* Workload stats from DB if available */}
              <h3 className="font-semibold pt-4">Activity</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {member.workload ? (
                  <>
                    <p>• {member.workload.pending} pending tasks</p>
                    <p>• {member.workload.completed} tasks completed</p>
                  </>
                ) : (
                  <>
                    <p>• Available for consultations</p>
                    <p>• Ready to engage on strategy sessions</p>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="p-6 space-y-6 mt-0">
              {/* Voice Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Voice Settings
                </h3>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Voice</p>
                    <p className="text-xs text-muted-foreground">Allow this advisor to speak responses</p>
                  </div>
                  <Switch
                    checked={settings.voiceEnabled}
                    onCheckedChange={(v) => handleSettingChange('voiceEnabled', v)}
                  />
                </div>

                {settings.voiceEnabled && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Voice Speed</span>
                        <span>{settings.voiceSpeed.toFixed(1)}x</span>
                      </div>
                      <Slider
                        value={[settings.voiceSpeed]}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        onValueChange={([v]) => handleSettingChange('voiceSpeed', v)}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Voice Pitch</span>
                        <span>{settings.voicePitch.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[settings.voicePitch]}
                        min={0.5}
                        max={1.5}
                        step={0.1}
                        onValueChange={([v]) => handleSettingChange('voicePitch', v)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Avatar Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold">Avatar Style</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['professional', 'casual', 'artistic'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={settings.avatarStyle === style ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSettingChange('avatarStyle', style)}
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notifications</p>
                  <p className="text-xs text-muted-foreground">Get notified when this advisor has insights</p>
                </div>
                <Switch
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(v) => handleSettingChange('notificationsEnabled', v)}
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ExecutiveProfileModal;