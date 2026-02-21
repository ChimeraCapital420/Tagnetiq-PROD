// FILE: api/boardroom/lib/types.ts
// Minimal shared types for api/boardroom/lib modules

export interface BoardMember {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  ai_provider: string;
  ai_model?: string;
  system_prompt?: string;
  expertise: string[];
  personality: Record<string, any>;
  voice_style?: string;
  trust_level?: number;
  ai_dna?: Record<string, number>;
  personality_evolution?: Record<string, any>;
  evolved_prompt?: string | null;
  total_interactions?: number;
}
