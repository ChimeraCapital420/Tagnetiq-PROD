// src/lib/video/script-generator.ts
import { AnalysisResult } from '../analysis/types';

interface ScriptGenerationParams {
  itemName: string;
  category: string;
  analysis: AnalysisResult | null;
  platform: 'youtube' | 'instagram' | 'tiktok';
  vibe: 'educational' | 'entertaining' | 'professional' | 'casual' | 'luxury';
}

export async function generateVideoScript(params: ScriptGenerationParams): Promise<string> {
  const { itemName, category, analysis, platform, vibe } = params;
  
  // Platform-specific formatting
  const formatters = {
    youtube: generateYouTubeScript,
    instagram: generateInstagramScript,
    tiktok: generateTikTokScript
  };

  const formatter = formatters[platform];
  return formatter(itemName, category, analysis, vibe);
}

function generateYouTubeScript(
  itemName: string, 
  category: string, 
  analysis: AnalysisResult | null,
  vibe: string
): string {
  const intro = getIntro(itemName, category, vibe);
  const details = getItemDetails(analysis);
  const value = getValueProposition(analysis);
  const conclusion = getConclusion(vibe);

  return `${intro}

[SHOWCASE ITEM - 5 seconds]

${details}

[DETAIL SHOTS - 10 seconds]

${value}

[AUTHENTICITY FEATURES - 8 seconds]

${conclusion}

[CALL TO ACTION - 5 seconds]
Don't forget to subscribe and hit the notification bell for more collectible insights!`;
}

function generateInstagramScript(
  itemName: string, 
  category: string, 
  analysis: AnalysisResult | null,
  vibe: string
): string {
  const hook = getHook(itemName, vibe);
  const keyPoints = getKeyPoints(analysis);
  
  return `${hook}

[QUICK REVEAL - 2 seconds]

${keyPoints}

[SWIPE THROUGH DETAILS - 8 seconds]

${getShortConclusion(vibe)}

[CTA OVERLAY]
Follow for more rare finds! 🔥`;
}

function generateTikTokScript(
  itemName: string, 
  category: string, 
  analysis: AnalysisResult | null,
  vibe: string
): string {
  return `POV: You just found a ${itemName} at a garage sale...

[DRAMATIC ZOOM - 2 seconds]

But wait... ${getQuickValue(analysis)}

[FAST CUTS OF DETAILS - 5 seconds]

${getTikTokPunchline(analysis)}

[REACTION SHOT - 2 seconds]

Drop a 💎 if you'd cop this!`;
}

function getIntro(itemName: string, category: string, vibe: string): string {
  const intros = {
    educational: `Today, we're examining a remarkable ${itemName}, a prime example of ${category} collecting.`,
    entertaining: `Whoa! Check out this incredible ${itemName}! You won't believe what makes it special!`,
    professional: `Welcome to our detailed analysis of the ${itemName}, a significant piece in the ${category} market.`,
    casual: `Hey collectors! Just got my hands on this awesome ${itemName}, and I had to share it with you.`,
    luxury: `Presenting an exquisite ${itemName}, a testament to refined taste in ${category} acquisition.`
  };
  
  return intros[vibe] || intros.professional;
}

function getItemDetails(analysis: AnalysisResult | null): string {
  if (!analysis) {
    return "This remarkable piece showcases exceptional craftsmanship and historical significance.";
  }

  const confidence = analysis.consensus.confidence;
  const details = analysis.consensus.details;

  return `Our AI analysis reveals a ${confidence}% authenticity confidence. 
Key features include: ${details.slice(0, 3).join(', ')}.
The estimated value range is $${analysis.consensus.estimatedValue.min} to $${analysis.consensus.estimatedValue.max}.`;
}

function getValueProposition(analysis: AnalysisResult | null): string {
  if (!analysis) {
    return "This item represents a unique investment opportunity for discerning collectors.";
  }

  const value = analysis.consensus.estimatedValue;
  const rarity = analysis.consensus.rarity || 'significant';

  return `With ${rarity} rarity and strong market demand, 
this piece offers excellent potential for appreciation. 
Current market indicators suggest a value between $${value.min} and $${value.max}.`;
}

function getConclusion(vibe: string): string {
  const conclusions = {
    educational: "Remember, knowledge is power in the collecting world. Stay informed, stay ahead.",
    entertaining: "That's all for now, collectors! Keep hunting for those hidden gems!",
    professional: "For serious collectors, this represents a compelling acquisition opportunity.",
    casual: "Hope you enjoyed this quick look! Let me know what you think in the comments!",
    luxury: "A true connoisseur recognizes value beyond mere price. This is one such opportunity."
  };

  return conclusions[vibe] || conclusions.professional;
}

function getHook(itemName: string, vibe: string): string {
  const hooks = {
    educational: `The ${itemName}: What every collector needs to know 📚`,
    entertaining: `OMG! Is this ${itemName} worth THOUSANDS?! 🤯`,
    professional: `Market Alert: ${itemName} Analysis 📊`,
    casual: `Found something cool! Check out this ${itemName} 👀`,
    luxury: `Exclusive: The ${itemName} Story ✨`
  };

  return hooks[vibe] || hooks.casual;
}

function getKeyPoints(analysis: AnalysisResult | null): string {
  if (!analysis) {
    return "✓ Rare find\n✓ Excellent condition\n✓ Investment potential";
  }

  return `✓ ${analysis.consensus.confidence}% Authentic
✓ Value: $${analysis.consensus.estimatedValue.min}-${analysis.consensus.estimatedValue.max}
✓ ${analysis.consensus.rarity || 'Rare'} availability`;
}

function getShortConclusion(vibe: string): string {
  const conclusions = {
    educational: "Learn more about collecting on our profile!",
    entertaining: "Would you buy this? Let us know!",
    professional: "Professional authentication available.",
    casual: "Happy hunting, everyone!",
    luxury: "Elevate your collection today."
  };

  return conclusions[vibe] || conclusions.casual;
}

function getQuickValue(analysis: AnalysisResult | null): string {
  if (!analysis) {
    return "This could be worth serious money!";
  }

  const maxValue = analysis.consensus.estimatedValue.max;
  return `It's worth up to $${maxValue.toLocaleString()}!`;
}

function getTikTokPunchline(analysis: AnalysisResult | null): string {
  if (!analysis) {
    return "Time to check grandma's attic! 📦";
  }

  const confidence = analysis.consensus.confidence;
  if (confidence > 90) {
    return "Jackpot! This is the real deal! 💰";
  } else if (confidence > 70) {
    return "Looking good! Might be sitting on gold! ✨";
  } else {
    return "Interesting find! Needs more research 🔍";
  }
}