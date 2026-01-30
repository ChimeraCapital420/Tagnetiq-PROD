// FILE: src/features/boardroom/components/ExecutiveProfileModal.tsx
// Modal showing board member details, projects, and voice chat activation

import React, { useState } from 'react';
import {
  X,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Settings,
  Briefcase,
  GraduationCap,
  Target,
  MessageSquare,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
// EXECUTIVE BIOS (Rich backgrounds for each board member)
// =============================================================================

const EXECUTIVE_BIOS: Record<string, {
  background: string;
  education: string[];
  expertise: string[];
  philosophy: string;
  currentFocus: string[];
  funFact: string;
}> = {
  ceo: {
    background: "Former founder of two successful e-commerce exits. 15+ years leading high-growth consumer products companies. Known for turning around struggling brands and identifying undervalued market opportunities.",
    education: ["MBA, Harvard Business School", "BS Economics, Wharton"],
    expertise: ["Strategic Planning", "M&A", "Brand Building", "Market Positioning", "Leadership"],
    philosophy: "Every item tells a story. Our job is to find the items whose stories are worth more than their price tags.",
    currentFocus: ["Q1 Growth Strategy", "New Category Expansion", "Team Scaling"],
    funFact: "Started reselling baseball cards at age 12, turned $50 into $5,000 by graduation."
  },
  cfo: {
    background: "Former investment banker at Goldman Sachs, specialized in consumer retail. CPA with expertise in inventory-based businesses. Built financial models for over $2B in retail transactions.",
    education: ["MBA Finance, Columbia", "CPA, New York"],
    expertise: ["Financial Modeling", "Cash Flow Optimization", "Tax Strategy", "Investment Analysis", "Risk Management"],
    philosophy: "Profit isn't just about selling high—it's about buying smart, holding right, and knowing when to move.",
    currentFocus: ["Margin Optimization", "Tax Planning", "Capital Allocation"],
    funFact: "Can calculate ROI on any item within 3 seconds of seeing it."
  },
  cmo: {
    background: "Built marketing departments at three unicorn startups. Expert in marketplace dynamics and seller branding. Pioneered influencer partnerships in the resale space.",
    education: ["BA Marketing, NYU Stern", "Google Analytics Certified"],
    expertise: ["Marketplace Strategy", "Brand Positioning", "Social Commerce", "SEO/SEM", "Content Strategy"],
    philosophy: "In resale, your reputation IS your brand. Every listing is a chance to tell your story.",
    currentFocus: ["Multi-Platform Strategy", "Seller Brand Building", "Community Growth"],
    funFact: "Viral tweet about a $2 thrift find that sold for $800 got 2M impressions."
  },
  coo: {
    background: "Former Amazon logistics manager, scaled fulfillment operations from startup to $100M. Expert in inventory management systems and operational efficiency.",
    education: ["MS Operations Research, MIT", "Six Sigma Black Belt"],
    expertise: ["Supply Chain", "Process Optimization", "Inventory Systems", "Automation", "Quality Control"],
    philosophy: "The fastest path to profit is eliminating waste. Every minute an item sits is money lost.",
    currentFocus: ["Listing Automation", "Shipping Optimization", "Storage Systems"],
    funFact: "Personal record: Listed 47 items in one hour with full descriptions and photos."
  },
  legal: {
    background: "IP attorney with 20 years experience in consumer products. Former general counsel for major auction house. Expert in authenticity verification and seller protection.",
    education: ["JD, Yale Law School", "BA Philosophy, Princeton"],
    expertise: ["IP Law", "Contract Negotiation", "Authenticity Standards", "Platform Compliance", "Risk Mitigation"],
    philosophy: "In resale, trust is everything. One fake item can destroy years of reputation building.",
    currentFocus: ["Authentication Protocols", "Platform Policy Updates", "Seller Protection"],
    funFact: "Successfully defended a client's right to resell limited edition sneakers against Nike."
  },
  strategy: {
    background: "Former McKinsey partner specializing in retail disruption. Advised Fortune 500 companies on digital transformation. Expert in competitive analysis and market entry.",
    education: ["MBA, Stanford GSB", "Rhodes Scholar, Oxford"],
    expertise: ["Competitive Analysis", "Market Research", "Growth Strategy", "Digital Transformation", "M&A Advisory"],
    philosophy: "The resale market rewards those who see trends before they become obvious. Data is your crystal ball.",
    currentFocus: ["Category Opportunities", "Platform Diversification", "Trend Analysis"],
    funFact: "Predicted the vintage Pyrex boom 18 months before it happened."
  },
  market: {
    background: "Data scientist who built pricing algorithms for major e-commerce platforms. Expert in market dynamics, pricing optimization, and demand forecasting.",
    education: ["PhD Economics, Chicago", "MS Statistics, Stanford"],
    expertise: ["Pricing Strategy", "Market Analysis", "Demand Forecasting", "Competitive Intelligence", "Data Science"],
    philosophy: "Price is a conversation between supply and demand. Learn to listen and you'll never leave money on the table.",
    currentFocus: ["Dynamic Pricing Models", "Comp Analysis Tools", "Market Trend Reports"],
    funFact: "Built a model that predicts eBay final prices within 5% accuracy."
  },
  sourcing: {
    background: "Legendary picker with 25+ years in the field. Discovered items worth millions in estate sales and thrift stores. Mentor to hundreds of successful resellers.",
    education: ["School of Hard Knocks", "30,000+ hours in the field"],
    expertise: ["Estate Sales", "Thrift Sourcing", "Auction Strategy", "Condition Assessment", "Hidden Gems"],
    philosophy: "The best items are hiding in plain sight. Train your eye and trust your gut.",
    currentFocus: ["Sourcing Route Optimization", "Relationship Building", "Training Programs"],
    funFact: "Found a $50,000 painting at a garage sale marked $25."
  },
  prometheus: {
    background: "Behavioral psychologist specializing in decision-making under uncertainty. Former professor studying cognitive biases in financial markets. Expert in the psychology of collecting and value perception.",
    education: ["PhD Clinical Psychology, University of Toronto", "Postdoc Behavioral Economics, Harvard"],
    expertise: ["Behavioral Psychology", "Decision Science", "Cognitive Bias", "Motivation", "Performance Psychology"],
    philosophy: "The market doesn't care about your feelings, but your feelings shape every decision you make. Master yourself first.",
    currentFocus: ["Reseller Mindset", "Decision Frameworks", "Emotional Discipline"],
    funFact: "Studied why people pay 10x more for 'vintage' vs 'used' - it's the same item."
  },
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

  const bio = EXECUTIVE_BIOS[member.id] || EXECUTIVE_BIOS.ceo;

  const handleSettingChange = (key: keyof MemberSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onUpdateSettings(member.id, newSettings);
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
            {/* Avatar */}
            <div className="relative">
              <div 
                className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white/20"
                style={{ 
                  backgroundImage: member.avatar ? `url(${member.avatar})` : undefined,
                  backgroundSize: 'cover',
                }}
              >
                {!member.avatar && member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 ${
                member.status === 'available' ? 'bg-green-500' :
                member.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
              }`} />
            </div>

            {/* Name and Title */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{member.name}</h2>
              <p className="text-blue-300">{member.role}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {member.specialties.slice(0, 3).map((specialty, i) => (
                  <Badge key={i} variant="secondary" className="bg-white/10 text-white/80 text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onStartVoiceChat(member.id);
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
                  onStartTextChat(member.id);
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

              {/* Expertise */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  Areas of Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                  {bio.expertise.map((skill, i) => (
                    <Badge key={i} variant="outline">{skill}</Badge>
                  ))}
                </div>
              </div>

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

              <h3 className="font-semibold pt-4">Recent Consultations</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Advised on 23 item analyses this week</p>
                <p>• Contributed to 8 sourcing decisions</p>
                <p>• Reviewed 5 pricing strategies</p>
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