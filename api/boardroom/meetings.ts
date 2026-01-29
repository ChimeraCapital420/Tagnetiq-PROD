// FILE: api/boardroom/meetings.ts
// Create and manage board meetings

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

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
  try {
    const user = await verifyUser(req);
    
    if (!await verifyBoardroomAccess(user.id)) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    // POST - Create new meeting
    if (req.method === 'POST') {
      const { title, meeting_type, participants, agenda } = req.body;

      if (!title || !meeting_type) {
        return res.status(400).json({ error: 'Title and meeting_type are required.' });
      }

      const validTypes = ['full_board', 'one_on_one', 'committee', 'vote', 'devils_advocate'];
      if (!validTypes.includes(meeting_type)) {
        return res.status(400).json({ error: `Invalid meeting_type. Must be: ${validTypes.join(', ')}` });
      }

      // For one_on_one, ensure only one participant
      if (meeting_type === 'one_on_one' && (!participants || participants.length !== 1)) {
        return res.status(400).json({ error: 'One-on-one meetings require exactly one participant.' });
      }

      // For committee, ensure 2-4 participants
      if (meeting_type === 'committee' && (!participants || participants.length < 2 || participants.length > 4)) {
        return res.status(400).json({ error: 'Committee meetings require 2-4 participants.' });
      }

      const { data: meeting, error } = await supaAdmin
        .from('boardroom_meetings')
        .insert({
          user_id: user.id,
          title,
          meeting_type,
          participants: participants || null, // null = all members for full_board
          agenda,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json(meeting);
    }

    // GET - Get meeting details with messages
    if (req.method === 'GET') {
      const { id } = req.query;

      if (!id) {
        // List all meetings for user
        const { data: meetings, error } = await supaAdmin
          .from('boardroom_meetings')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(meetings);
      }

      // Get specific meeting with messages
      const { data: meeting, error: meetingError } = await supaAdmin
        .from('boardroom_meetings')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (meetingError || !meeting) {
        return res.status(404).json({ error: 'Meeting not found.' });
      }

      // Get messages
      const { data: messages, error: messagesError } = await supaAdmin
        .from('boardroom_messages')
        .select('*')
        .eq('meeting_id', id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Get participants info if specific members
      let participantDetails = null;
      if (meeting.participants && meeting.participants.length > 0) {
        const { data: members } = await supaAdmin
          .from('boardroom_members')
          .select('id, slug, name, title, avatar_url')
          .in('id', meeting.participants);
        participantDetails = members;
      }

      return res.status(200).json({
        ...meeting,
        messages: messages || [],
        participant_details: participantDetails,
      });
    }

    // PATCH - Update meeting (conclude, archive)
    if (req.method === 'PATCH') {
      const { id, status, summary, decisions } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Meeting ID is required.' });
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      
      if (status) {
        if (status === 'concluded') {
          updateData.status = 'concluded';
          updateData.concluded_at = new Date().toISOString();
        } else if (status === 'archived') {
          updateData.status = 'archived';
        }
      }
      
      if (summary) updateData.summary = summary;
      if (decisions) updateData.decisions = decisions;

      const { data: meeting, error } = await supaAdmin
        .from('boardroom_meetings')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(meeting);
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Boardroom meetings error:', message);
    return res.status(500).json({ error: message });
  }
}