// FILE: src/pages/Dashboard.tsx
// v11.0 — OracleGreeting + OracleNarrator integration
// v11.1 — RH-029 Oracle Daily Digest card added
//
// WHAT'S NEW in v11.1:
//   - OracleDailyDigest card appears above Welcome Card
//   - Fetches from /api/daily-digest once per day (cached)
//   - Shows Oracle commentary, vault snapshot, day tip
//   - Dismissible — user can hide it until tomorrow

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORIES } from '@/lib/constants';
import AnalysisResult from '@/components/AnalysisResult';
import SubCategoryModal from '@/components/SubCategoryModal';
import OracleVisualizer from '@/components/OracleVisualizer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { subCategories } from '@/lib/subcategories';
import SpotlightCarousel from '@/components/dashboard/SpotlightCarousel';
import CommunityMoments from '@/components/dashboard/CommunityMoments';
import SharePromptBanner from '@/components/oracle/SharePromptBanner';
import { ChevronDown, ChevronUp, SlidersHorizontal, X, Zap, Archive, Calendar } from 'lucide-react';
import { useWelcomeMessage } from '@/hooks/useWelcomeMessage';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSharePrompt } from '@/hooks/useSharePrompt';

// v11.0: Oracle Greeting + Narrator
import OracleGreeting from '@/components/oracle/OracleGreeting';
import OracleNarrator from '@/components/oracle/OracleNarrator';

// =============================================================================
// ORACLE DAILY DIGEST CARD — RH-029
// =============================================================================

const OracleDailyDigest: React.FC<{ userId: string }> = ({ userId }) => {
  const [digest, setDigest] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if dismissed today
    const today = new Date().toISOString().split('T')[0];
    const dismissedDate = localStorage.getItem('tagnetiq_digest_dismissed');
    if (dismissedDate === today) { setLoading(false); setDismissed(true); return; }

    fetch(`/api/daily-digest?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(data => { if (data.success) setDigest(data.digest); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('tagnetiq_digest_dismissed', today);
    setDismissed(true);
  };

  if (loading || dismissed || !digest) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Oracle commentary */}
      <div className="flex items-start gap-3 pr-6">
        <span className="text-xl shrink-0">🔮</span>
        <div>
          <p className="text-sm font-medium text-white leading-snug">{digest.commentary}</p>
          <p className="text-xs text-white/40 mt-1">Oracle Daily · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats row */}
      {digest.vaultSnapshot?.itemCount > 0 && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-white/60">{digest.vaultSnapshot.itemCount} items scanned</span>
          </div>
          {digest.vaultSnapshot.totalValue > 0 && (
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-white/60">${digest.vaultSnapshot.totalValue.toFixed(0)} total value</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// DASHBOARD
// =============================================================================

const Dashboard: React.FC = () => {
  useWelcomeMessage();

  const { lastAnalysisResult, selectedCategory, setSelectedCategory } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<{ id: string; name: string } | null>(null);
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] = useState(false);
  const { user, profile } = useAuth();
  const { trackEvent, trackFeature } = useAnalytics();
  const { checkSharePrompt, sharePrompt, handleShare, dismissPrompt } = useSharePrompt();

  const firstScanFiredRef = useRef(false);

  useEffect(() => {
    trackEvent('page_view', 'engagement', { page: 'dashboard' });
  }, [trackEvent]);

  useEffect(() => {
    if (lastAnalysisResult && !firstScanFiredRef.current) {
      firstScanFiredRef.current = true;
      window.dispatchEvent(new CustomEvent('tagnetiq:first-scan-complete', {
        detail: {
          hasAuthority: !!lastAnalysisResult.authorityData,
          category: lastAnalysisResult.category,
        },
      }));
    }
  }, [lastAnalysisResult]);

  useEffect(() => {
    if (lastAnalysisResult) {
      const value = parseFloat(
        String(lastAnalysisResult.estimatedValue || '0').replace(/[^0-9.]/g, '')
      );
      const confidence = lastAnalysisResult.confidence || 0;

      if (value > 500 && confidence > 0.85) {
        checkSharePrompt('great_scan', { category: selectedCategory, value });
      } else if (value > 100) {
        checkSharePrompt('great_scan', { category: selectedCategory, value });
      } else if (!profile?.has_seen_arena_intro) {
        checkSharePrompt('first_scan', { category: selectedCategory });
      }
    }
  }, [lastAnalysisResult]);

  const handleCategorySelect = (category: { id: string; name: string; }) => {
    setSelectedCategory(category.id);
    toast.info(`AI mode set to ${category.name}.`);
    trackFeature(`category_select_${category.id}`);

    const availableSubCategories = subCategories[category.id] || [];
    if (availableSubCategories.length > 0) {
      setCurrentCategory(category);
      setIsSubCategoryModalOpen(true);
    } else {
      setIsCategoryPanelOpen(false);
    }
  };

  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    for (const cat of CATEGORIES) {
      if (cat.id === selectedCategory) return cat.name;
      const sub = subCategories[cat.id]?.find(s => s.id === selectedCategory);
      if (sub) return `${cat.name}: ${sub.name}`;
    }
    const parentCategory = CATEGORIES.find(c => selectedCategory.startsWith(c.id));
    return parentCategory?.name || 'General';
  };

  const displayName = profile?.screen_name || profile?.full_name || user?.email || 'Tester';

  return (
    <>
      <div className="relative z-10 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* v11.0: Oracle Greeting */}
          <OracleGreeting />

          {/* v11.1: Oracle Daily Digest — RH-029 */}
          {user?.id && <OracleDailyDigest userId={user.id} />}

          {/* Welcome Card with Spotlight */}
          <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center">
              <div className="p-8">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {displayName}!</h1>
                <p className="mt-2 text-muted-foreground">
                  Current Mode: <span className="font-semibold text-primary">{getCategoryDisplayName()}</span>
                </p>
              </div>
              <div className="h-48 md:h-full w-full">
                <SpotlightCarousel />
              </div>
            </div>
          </Card>

          {/* Analysis Result */}
          {lastAnalysisResult && (
            <div className="flex justify-center" data-tour="scan-result">
              <AnalysisResult />
            </div>
          )}

          {/* Community Moments */}
          <CommunityMoments />

          {/* Collapsible Category Panel */}
          <div className="space-y-3">
            <button
              onClick={() => {
                setIsCategoryPanelOpen(!isCategoryPanelOpen);
                if (!isCategoryPanelOpen) trackFeature('category_panel_open');
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Refine Category</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              {isCategoryPanelOpen
                ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
                : <ChevronDown className="h-5 w-5 text-muted-foreground" />
              }
            </button>

            <div className={`grid grid-cols-3 sm:grid-cols-3 gap-3 overflow-hidden transition-all duration-300 ease-in-out ${
              isCategoryPanelOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id ||
                  selectedCategory?.startsWith(category.id);
                return (
                  <Card
                    key={category.id}
                    className={`overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary transition-all group cursor-pointer text-center ${
                      isSelected ? 'border-primary ring-1 ring-primary/20' : ''
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <CardHeader className="p-3 flex-col items-center">
                      <category.icon className={`h-6 w-6 mb-1 ${isSelected ? 'text-primary' : ''}`} />
                      <CardTitle className="text-sm">{category.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {currentCategory && (
        <SubCategoryModal
          isOpen={isSubCategoryModalOpen}
          onClose={() => {
            setIsSubCategoryModalOpen(false);
            setIsCategoryPanelOpen(false);
          }}
          categoryId={currentCategory.id}
          categoryName={currentCategory.name}
        />
      )}

      <OracleVisualizer />
      <OracleNarrator />

      {sharePrompt && (
        <SharePromptBanner
          message={sharePrompt.message}
          onShare={handleShare}
          onDismiss={dismissPrompt}
        />
      )}
    </>
  );
};

export default Dashboard;