// FILE: src/pages/WellnessPage.tsx  (or src/components/wellness/WellnessPage.tsx)
// Route: /wellness
// Entry point for all wellness features: Kirtan Kriya, Solfeggio, Haptics.
// Add this route to your App.tsx:
//   <Route path="/wellness" element={<WellnessPage />} />
// Add a nav entry pointing to /wellness from wherever makes sense.

import React, { useState } from 'react';
import KirtanKriyaTimer from '@/components/wellness/KirtanKriyaTimer';
import { Heart, Music, Vibrate, ChevronRight } from 'lucide-react';
import { KirtanKriyaSession } from '@/lib/wellness/solfeggio-kirtan';

const WELLNESS_FEATURES = [
  {
    id: 'kirtan',
    title: 'Kirtan Kriya',
    subtitle: '12-minute SA TA NA MA meditation',
    description: 'Clinically studied. 43% increase in telomerase activity. One of the most evidence-backed short meditation practices available.',
    icon: '🕉',
    duration: '12 min',
    cost: 'Free',
  },
];

const WellnessPage: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const streak = KirtanKriyaSession.getStreak();

  if (activeFeature === 'kirtan') {
    return (
      <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <button
            onClick={() => setActiveFeature(null)}
            className="text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            ← Back
          </button>
          <p className="text-sm font-medium text-white">Kirtan Kriya</p>
        </div>
        <KirtanKriyaTimer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="w-5 h-5 text-purple-400" />
          <h1 className="text-xl font-bold text-white">Wellness</h1>
        </div>
        <p className="text-white/40 text-sm">Mindfulness and healing practices built for the reseller lifestyle.</p>

        {streak.streak > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-500/20">
            <span className="text-lg">🔥</span>
            <div>
              <p className="text-xs font-semibold text-amber-300">{streak.streak} day meditation streak</p>
              <p className="text-xs text-amber-400/50">
                {streak.isTodayComplete ? 'Completed today ✓' : 'Not yet done today'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="px-4 space-y-3">
        {WELLNESS_FEATURES.map(feature => (
          <button
            key={feature.id}
            onClick={() => setActiveFeature(feature.id)}
            className="w-full flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.99] text-left"
          >
            <span className="text-3xl shrink-0 mt-0.5">{feature.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-white">{feature.title}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-500/20">
                  {feature.duration}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/20">
                  {feature.cost}
                </span>
              </div>
              <p className="text-xs text-white/40 mb-1">{feature.subtitle}</p>
              <p className="text-xs text-white/30 leading-relaxed">{feature.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />
          </button>
        ))}
      </div>

      {/* Science note */}
      <div className="px-4 mt-6 mb-8">
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          <p className="text-xs text-white/30 leading-relaxed">
            Kirtan Kriya is one of the most clinically studied meditation practices in neuroscience.
            A UCLA study found 12 minutes daily for 8 weeks improved memory, reduced stress hormones,
            and increased telomerase activity by 43%. This is not wellness theater — it is evidence-backed practice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WellnessPage;