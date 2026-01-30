// FILE: api/boardroom/voice-chat.ts
// Voice chat API endpoint - handles voice-to-voice board communication
// Receives transcribed speech, generates AI responses, returns audio

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildBoardMemberPrompt } from './lib/prompt-builder';

export const config = {
  maxDuration: 60,
};

// ============================================================================
// TYPES
// ============================================================================

interface VoiceChatRequest {
  message: string;
  meeting_id?: string;
  session_type: 'full_board' | 'one_on_one';
  target_members: string[];
  generate_audio: boolean;
}

interface BoardMemberResponse {
  member: {
    slug: string;
    name: string;
    title: string;
    ai_provider: string;
  };
  content: string;
  audio?: string; // Base64 encoded audio
}

// ============================================================================
// VOICE CONFIGURATIONS
// ============================================================================

const ELEVENLABS_VOICES: Record<string, string> = {
  athena: 'EXAVITQu4vr4xnSDxMaL', // Female, professional
  griffin: 'TxGEqnHWrfWFTfGW9XjX', // Male, authoritative
  scuba: 'VR6AewLTigWG4xSOukaG', // Male, friendly
  glitch: 'pNInz6obpgDQGcFmaJgB', // Energetic
  lexicoda: 'yoZ06aMxZJJ28mfd3POQ', // Professional, precise
  vulcan: 'onwK4e9ZLuTAKqWW03F9', // Technical, clear
  prometheus: 'ODq5zmih8GrVes37Dizd', // Thoughtful, deep
  phoenix: 'XB0fDUnXU5powFXDhCwa', // Warm, inspiring
  cipher: 'SOYHLrjzK2X1ezoPC6cr', // Analytical
  default: 'TxGEqnHWrfWFTfGW9XjX',
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { 
      message, 
      meeting_id, 
      session_type, 
      target_members, 
      generate_audio 
    }: VoiceChatRequest = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`🎤 Voice chat: "${message.substring(0, 50)}..." to ${target_members.length} members`);

    // Fetch board members
    const { data: members, error: membersError } = await supabase
      .from('boardroom_members')
      .select('*')
      .in('slug', target_members)
      .eq('is_active', true);

    if (membersError || !members?.length) {
      return res.status(400).json({ error: 'No valid board members found' });
    }

    // For voice, we want faster responses - limit to 2-3 members for full board
    const respondingMembers = session_type === 'full_board' 
      ? members.slice(0, 3) // Limit for faster voice response
      : members;

    // Generate responses in parallel
    const responsePromises = respondingMembers.map(async (member) => {
      try {
        const response = await generateMemberResponse(member, message, session_type);
        
        let audio: string | undefined;
        if (generate_audio && response) {
          audio = await generateSpeech(response, member.slug);
        }

        return {
          member: {
            slug: member.slug,
            name: member.name,
            title: member.title,
            ai_provider: member.ai_provider,
          },
          content: response,
          audio,
        } as BoardMemberResponse;
      } catch (err) {
        console.error(`Error from ${member.name}:`, err);
        return null;
      }
    });

    const responses = (await Promise.all(responsePromises)).filter(Boolean);

    // Save messages to database if meeting exists
    if (meeting_id) {
      await saveMeetingMessages(supabase, meeting_id, user.id, message, responses);
    }

    return res.status(200).json({ responses });

  } catch (error) {
    console.error('Voice chat error:', error);
    return res.status(500).json({ error: 'Voice chat failed' });
  }
}

// ============================================================================
// AI RESPONSE GENERATION
// ============================================================================

async function generateMemberResponse(
  member: any,
  userMessage: string,
  sessionType: string
): Promise<string> {
  const { systemPrompt, userPrompt } = buildBoardMemberPrompt({
    member,
    userMessage,
    meetingType: sessionType === 'full_board' ? 'full_board' : 'one_on_one',
    conversationHistory: [],
  });

  // Add voice-specific instructions
  const voiceSystemPrompt = `${systemPrompt}

## VOICE CONVERSATION MODE
You are speaking out loud in a real-time voice conversation. Adjust your response:
- Keep responses concise (2-4 sentences for quick exchanges)
- Use natural spoken language, not written prose
- Avoid bullet points, headers, or formatting
- Be direct and conversational
- If the question needs a longer answer, give the key point first, then offer to elaborate
`;

  const response = await callAIProvider(member.ai_provider, voiceSystemPrompt, userPrompt);
  return response;
}

async function callAIProvider(
  provider: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return callAnthropic(systemPrompt, userPrompt);
    case 'openai':
      return callOpenAI(systemPrompt, userPrompt);
    case 'groq':
      return callGroq(systemPrompt, userPrompt);
    default:
      return callOpenAI(systemPrompt, userPrompt);
  }
}

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500, // Shorter for voice
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// TEXT-TO-SPEECH
// ============================================================================

async function generateSpeech(text: string, memberSlug: string): Promise<string | undefined> {
  const voiceId = ELEVENLABS_VOICES[memberSlug] || ELEVENLABS_VOICES.default;
  
  if (!process.env.ELEVENLABS_API_KEY) {
    // Fall back to OpenAI TTS
    return generateOpenAISpeech(text);
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2', // Faster model for real-time
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      console.error('ElevenLabs error:', await response.text());
      return generateOpenAISpeech(text);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer).toString('base64');
    
  } catch (error) {
    console.error('TTS error:', error);
    return undefined;
  }
}

async function generateOpenAISpeech(text: string): Promise<string | undefined> {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'onyx',
        input: text,
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI TTS error');
      return undefined;
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer).toString('base64');
    
  } catch (error) {
    console.error('OpenAI TTS error:', error);
    return undefined;
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function saveMeetingMessages(
  supabase: any,
  meetingId: string,
  userId: string,
  userMessage: string,
  responses: (BoardMemberResponse | null)[]
) {
  try {
    // Save user message
    await supabase.from('boardroom_messages').insert({
      meeting_id: meetingId,
      sender_type: 'user',
      sender_id: userId,
      content: userMessage,
    });

    // Save board member responses
    for (const response of responses) {
      if (!response) continue;
      
      await supabase.from('boardroom_messages').insert({
        meeting_id: meetingId,
        sender_type: 'board_member',
        member_slug: response.member.slug,
        content: response.content,
      });
    }
  } catch (error) {
    console.error('Error saving messages:', error);
  }
}