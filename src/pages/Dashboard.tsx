// FILE: src/pages/Dashboard.tsx

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
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useWelcomeMessage } from '@/hooks/useWelcomeMessage';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSharePrompt } from '@/hooks/useSharePrompt';

const Dashboard: React.FC = () => {
  // Send welcome message to new users (runs once after onboarding)
  useWelcomeMessage();

  const { lastAnalysisResult, selectedCategory, setSelectedCategory } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<{ id: string; name: string } | null>(null);
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] = useState(false);
  const { user, profile } = useAuth();
  const { trackEvent, trackFeature } = useAnalytics();
  const { checkSharePrompt, sharePrompt, handleShare, dismissPrompt } = useSharePrompt();

  // Track whether we've dispatched the first-scan-complete event this session
  const firstScanFiredRef = useRef(false);

  // Track dashboard view (Sprint E+)
  useEffect(() => {
    trackEvent('page_view', 'engagement', { page: 'dashboard' });
  }, [trackEvent]);

  // ── Dispatch first-scan-complete event for tour system ──
  // Fires once per session when the first analysis result appears.
  // TourOverlay listens for this to trigger the first_results tour.
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

  // Check for share prompt when a new scan result arrives
  useEffect(() => {
    if (lastAnalysisResult) {
      // Determine the right trigger based on scan quality
      const value = parseFloat(
        String(lastAnalysisResult.estimatedValue || '0').replace(/[^0-9.]/g, '')
      );
      const confidence = lastAnalysisResult.confidence || 0;

      if (value > 500 && confidence > 0.85) {
        checkSharePrompt('great_scan', { category: selectedCategory, value });
      } else if (value > 100) {
        checkSharePrompt('great_scan', { category: selectedCategory, value });
      }
      // First scan check
      else if (!profile?.has_seen_arena_intro) {
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
      // Close the panel after selection if no subcategories
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

  // Get display name with fallback chain: screen_name -> full_name -> email -> 'Tester'
  const displayName = profile?.screen_name || profile?.full_name || user?.email || 'Tester';

  return (
    <>
      <div className="relative z-10 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
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

          {/* Analysis Result — data-tour target for scan results */}
          {lastAnalysisResult && (
            <div className="flex justify-center" data-tour="scan-result">
              <AnalysisResult />
            </div>
          )}

          {/* Community Moments — social proof feed (only renders if published moments exist) */}
          <CommunityMoments />

          {/* Collapsible Category Refinement Panel */}
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
              {isCategoryPanelOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {/* Expandable Category Grid */}
            <div
              className={`grid grid-cols-3 sm:grid-cols-3 gap-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCategoryPanelOpen 
                  ? 'max-h-[600px] opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}
            >
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

      {/* Share Prompt — Oracle's gentle nudge (bottom banner, auto-dismisses) */}
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