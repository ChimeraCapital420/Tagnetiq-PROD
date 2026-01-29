// FILE: api/boardroom/chat.ts
// Multi-provider AI chat with company context injection

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

interface BoardMember {
  id: string;
  slug: string;
  name: string;
  title: string;
  ai_provider: string;
  ai_model: string;
  system_prompt: string;
  personality: any;
  voice_style: string;
  avatar_url: string;
}

interface Memory {
  content: string;
  memory_type: string;
  importance: number;
}

interface CompanyContext {
  context_type: string;
  title: string;
  content: string;
  priority: number;
}

// =============================================================================
// API KEY LOOKUP (from HYDRA providers.ts)
// =============================================================================
const ENV_KEYS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_SECRET'],
  google: ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  gemini: ['GOOGLE_AI_API_KEY', 'GOOGLE_AI_TOKEN', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  groq: ['GROQ_API_KEY'],
  xai: ['XAI_API_KEY', 'XAI_SECRET', 'GROK_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY', 'DEEPSEEK_TOKEN'],
};

function getApiKey(provider: string): string | null {
  const keys = ENV_KEYS[provider.toLowerCase()];
  if (!keys) return null;
  
  for (const envKey of keys) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

// =============================================================================
// GET COMPANY CONTEXT - The "Company Bible" all board members know
// =============================================================================
async function getCompanyContext(): Promise<string> {
  const { data } = await supaAdmin
    .from('boardroom_company_context')
    .select('title, content')
    .eq('is_active', true)
    .order('priority', { ascending: false });
  
  if (!data || data.length === 0) return '';
  
  let context = '\n\n# === TAGNETIQ COMPANY KNOWLEDGE ===\n';
  context += 'As a board member, you have complete knowledge of the company:\n\n';
  
  for (const item of data) {
    context += `${item.content}\n\n`;
  }
  
  context += '# === END COMPANY KNOWLEDGE ===\n';
  return context;
}

// Get member's memories for context
async function getMemberMemories(userId: string, memberId: string, limit = 20): Promise<Memory[]> {
  const { data } = await supaAdmin
    .from('boardroom_member_memory')
    .select('content, memory_type, importance')
    .eq('user_id', userId)
    .eq('member_id', memberId)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return data || [];
}

// Get recent conversation history from this meeting
async function getMeetingHistory(meetingId: string, limit = 20): Promise<any[]> {
  const { data } = await supaAdmin
    .from('boardroom_messages')
    .select('sender_type, member_slug, content, created_at')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (data || []).reverse();
}

// Save memory from conversation
async function saveMemory(userId: string, memberId: string, content: string, type: string, meetingId: string, importance = 5) {
  await supaAdmin
    .from('boardroom_member_memory')
    .upsert({
      user_id: userId,
      member_id: memberId,
      memory_type: type,
      content,
      importance,
      source_meeting_id: meetingId,
    }, {
      onConflict: 'user_id,member_id,content',
      ignoreDuplicates: true,
    });
}

// Build context for AI - now includes company context
function buildContext(member: BoardMember, companyContext: string, memories: Memory[], history: any[]): string {
  let context = companyContext; // Start with company knowledge
  
  if (memories.length > 0) {
    context += '\n\n## Your Personal Memory (previous interactions with this CEO):\n';
    memories.forEach(m => {
      context += `- [${m.memory_type}] ${m.content}\n`;
    });
  }
  
  if (history.length > 0) {
    context += '\n\n## Current Meeting Conversation:\n';
    history.forEach(msg => {
      const speaker = msg.sender_type === 'user' ? 'CEO' : msg.member_slug?.toUpperCase();
      context += `${speaker}: ${msg.content}\n`;
    });
  }
  
  return context;
}

// ========== AI PROVIDER CALLS ==========

// OpenAI
async function callOpenAI(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('openai');
  if (!apiKey) throw new Error('OpenAI API key not configured');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      temperature: 0.8,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// Anthropic (Claude)
async function callAnthropic(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) throw new Error('Anthropic API key not configured');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      system: member.system_prompt + context,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || '';
}

// Groq
async function callGroq(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('groq');
  if (!apiKey) throw new Error('Groq API key not configured');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// Google Gemini
async function callGoogle(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('google');
  if (!apiKey) throw new Error('Google AI API key not configured');
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${member.ai_model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: `${member.system_prompt}\n${context}\n\nCEO: ${userMessage}` }] 
        }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// xAI (Grok)
async function callXAI(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('xai');
  if (!apiKey) throw new Error('xAI API key not configured');
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// Perplexity
async function callPerplexity(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('perplexity');
  if (!apiKey) throw new Error('Perplexity API key not configured');
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// DeepSeek
async function callDeepSeek(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('deepseek');
  if (!apiKey) throw new Error('DeepSeek API key not configured');
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// Mistral
async function callMistral(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const apiKey = getApiKey('mistral');
  if (!apiKey) throw new Error('Mistral API key not configured');
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// Get AI response based on provider
async function getAIResponse(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const provider = member.ai_provider.toLowerCase();
  
  switch (provider) {
    case 'anthropic':
      return callAnthropic(member, context, userMessage);
    case 'openai':
      return callOpenAI(member, context, userMessage);
    case 'groq':
      return callGroq(member, context, userMessage);
    case 'google':
    case 'gemini':
      return callGoogle(member, context, userMessage);
    case 'xai':
      return callXAI(member, context, userMessage);
    case 'perplexity':
      return callPerplexity(member, context, userMessage);
    case 'deepseek':
      return callDeepSeek(member, context, userMessage);
    case 'mistral':
      return callMistral(member, context, userMessage);
    default:
      throw new Error(`Unknown AI provider: ${member.ai_provider}`);
  }
}

async function verifyBoardroomAccess(userId: string): Promise<boolean> {
  const { data } = await supaAdmin
    .from('boardroom_access')
    .select('access_level, expires_at')
    .eq('user_id', userId)
    .single();

  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    
    if (!await verifyBoardroomAccess(user.id)) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    const { meeting_id, message, respond_as } = req.body;

    if (!meeting_id || !message) {
      return res.status(400).json({ error: 'meeting_id and message are required.' });
    }

    // Verify meeting belongs to user
    const { data: meeting, error: meetingError } = await supaAdmin
      .from('boardroom_meetings')
      .select('*')
      .eq('id', meeting_id)
      .eq('user_id', user.id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    if (meeting.status !== 'active') {
      return res.status(400).json({ error: 'Meeting is not active.' });
    }

    // Save user message
    const { data: userMsg } = await supaAdmin
      .from('boardroom_messages')
      .insert({
        meeting_id,
        sender_type: 'user',
        sender_id: user.id,
        content: message,
        message_type: 'message',
      })
      .select()
      .single();

    // Determine which members should respond
    let memberSlugs: string[] = [];
    
    if (respond_as === 'all' || !respond_as) {
      if (meeting.participants) {
        const { data: members } = await supaAdmin
          .from('boardroom_members')
          .select('slug')
          .in('id', meeting.participants);
        memberSlugs = (members || []).map(m => m.slug);
      } else {
        const { data: members } = await supaAdmin
          .from('boardroom_members')
          .select('slug')
          .eq('is_active', true)
          .order('display_order');
        memberSlugs = (members || []).map(m => m.slug);
      }
    } else if (Array.isArray(respond_as)) {
      memberSlugs = respond_as;
    } else {
      memberSlugs = [respond_as];
    }

    // Get member details
    const { data: members, error: membersError } = await supaAdmin
      .from('boardroom_members')
      .select('*')
      .in('slug', memberSlugs)
      .eq('is_active', true)
      .order('display_order');

    if (membersError || !members || members.length === 0) {
      return res.status(400).json({ error: 'No valid board members to respond.' });
    }

    // Get shared context
    const companyContext = await getCompanyContext();
    const history = await getMeetingHistory(meeting_id);

    // Generate responses from each member (in parallel for speed)
    const responsePromises = members.map(async (member) => {
      try {
        const memories = await getMemberMemories(user.id, member.id);
        const context = buildContext(member, companyContext, memories, history);
        const aiResponse = await getAIResponse(member, context, message);
        
        // Save response
        const { data: savedMsg } = await supaAdmin
          .from('boardroom_messages')
          .insert({
            meeting_id,
            sender_type: 'board_member',
            sender_id: member.id,
            member_slug: member.slug,
            content: aiResponse,
            message_type: 'message',
            ai_provider: member.ai_provider,
          })
          .select()
          .single();

        // Auto-extract memories from important responses
        const lowerResponse = aiResponse.toLowerCase();
        if (lowerResponse.includes('remember') || 
            lowerResponse.includes('note that') ||
            lowerResponse.includes('important:') ||
            lowerResponse.includes('decision:') ||
            lowerResponse.includes('action item') ||
            lowerResponse.includes('recommend')) {
          await saveMemory(user.id, member.id, `From meeting: ${aiResponse.substring(0, 500)}`, 'decision', meeting_id, 7);
        }

        return {
          member: {
            slug: member.slug,
            name: member.name,
            title: member.title,
            avatar_url: member.avatar_url,
            ai_provider: member.ai_provider,
          },
          content: aiResponse,
          message_id: savedMsg?.id,
        };
      } catch (memberError: any) {
        console.error(`Error from ${member.slug} (${member.ai_provider}):`, memberError.message);
        return {
          member: {
            slug: member.slug,
            name: member.name,
            title: member.title,
            avatar_url: member.avatar_url,
          },
          content: `[${member.name} is temporarily unavailable. ${member.ai_provider} error: ${memberError.message}]`,
          error: true,
        };
      }
    });

    const responses = await Promise.all(responsePromises);

    // Update meeting timestamp
    await supaAdmin
      .from('boardroom_meetings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', meeting_id);

    return res.status(200).json({
      user_message: userMsg,
      responses,
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    console.error('Boardroom chat error:', errMsg);
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg });
  }
}