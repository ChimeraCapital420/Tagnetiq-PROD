// FILE: api/boardroom/chat.ts
// Multi-provider AI chat with memory - supports 8 AI providers

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Initialize AI clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Build context for AI
function buildContext(member: BoardMember, memories: Memory[], history: any[]): string {
  let context = '';
  
  if (memories.length > 0) {
    context += '\n\n## Your Memory (things you know about this user/company):\n';
    memories.forEach(m => {
      context += `- [${m.memory_type}] ${m.content}\n`;
    });
  }
  
  if (history.length > 0) {
    context += '\n\n## Recent Conversation:\n';
    history.forEach(msg => {
      const speaker = msg.sender_type === 'user' ? 'CEO' : msg.member_slug?.toUpperCase();
      context += `${speaker}: ${msg.content}\n`;
    });
  }
  
  return context;
}

// ========== AI PROVIDER CALLS ==========

// Anthropic (Claude)
async function callAnthropic(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: member.ai_model,
    max_tokens: 1024,
    system: member.system_prompt + context,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// OpenAI (GPT-4)
async function callOpenAI(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: member.ai_model,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: member.system_prompt + context },
      { role: 'user', content: userMessage },
    ],
  });
  return response.choices[0]?.message?.content || '';
}

// Groq (Llama)
async function callGroq(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: member.ai_model,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: member.system_prompt + context },
      { role: 'user', content: userMessage },
    ],
  });
  return response.choices[0]?.message?.content || '';
}

// Gemini
async function callGemini(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const model = gemini.getGenerativeModel({ model: member.ai_model });
  const prompt = `${member.system_prompt}\n${context}\n\nUser message: ${userMessage}`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// xAI (Grok) - OpenAI-compatible API
async function callXAI(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Perplexity - OpenAI-compatible API
async function callPerplexity(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// DeepSeek - OpenAI-compatible API
async function callDeepSeek(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Mistral - OpenAI-compatible API
async function callMistral(member: BoardMember, context: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: member.ai_model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: member.system_prompt + context },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Get AI response based on provider
async function getAIResponse(member: BoardMember, context: string, userMessage: string): Promise<string> {
  switch (member.ai_provider) {
    case 'anthropic':
      return callAnthropic(member, context, userMessage);
    case 'openai':
      return callOpenAI(member, context, userMessage);
    case 'groq':
      return callGroq(member, context, userMessage);
    case 'gemini':
      return callGemini(member, context, userMessage);
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

    // Get meeting history
    const history = await getMeetingHistory(meeting_id);

    // Generate responses from each member (in parallel for speed)
    const responsePromises = members.map(async (member) => {
      try {
        const memories = await getMemberMemories(user.id, member.id);
        const context = buildContext(member, memories, history);
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

        // Auto-extract memories
        if (aiResponse.toLowerCase().includes('remember') || 
            aiResponse.toLowerCase().includes('note that') ||
            aiResponse.toLowerCase().includes('important:') ||
            aiResponse.toLowerCase().includes('decision:')) {
          await saveMemory(user.id, member.id, `From meeting: ${aiResponse.substring(0, 200)}`, 'decision', meeting_id, 7);
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
          content: `[${member.name} is temporarily unavailable. ${member.ai_provider} service issue.]`,
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
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Boardroom chat error:', message);
    return res.status(500).json({ error: message });
  }
}