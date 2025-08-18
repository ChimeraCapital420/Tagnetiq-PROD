// FILE: api/admin/health-check.ts (CREATE THIS NEW FILE)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// This is a simplified check. A real-world, low-cost check is preferred.
// For example, listing models is a good, low-cost way to verify API key validity.

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { service } = req.query;

    // In a real app, you'd add admin role verification here first.

    try {
        switch (service) {
            case 'openai':
                const openai = new OpenAI({ apiKey: process.env.OPENAI_TOKEN });
                await openai.models.list();
                break;
            case 'anthropic':
                const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_SECRET });
                // A very small, simple request to verify the key
                await anthropic.messages.create({
                  model: 'claude-3-haiku-20240307', // Use the cheapest/fastest model
                  max_tokens: 1,
                  messages: [{ role: 'user', content: 'hello' }],
                });
                break;
            case 'google':
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_TOKEN as string);
                const model = genAI.getGenerativeModel({ model: "gemini-pro"});
                await model.generateContent("hello"); // Simple ping
                break;
            default:
                return res.status(400).json({ status: 'error', message: 'Invalid service specified' });
        }
        return res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error(`Health check error for ${service}:`, error);
        return res.status(500).json({ status: 'error', message: (error as Error).message });
    }
}
