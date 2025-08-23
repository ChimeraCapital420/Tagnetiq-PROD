// FILE: api/analyze.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, User } from '@supabase/supabase-js';
import { verifyUser } from './_lib/security';

export const config = {
  runtime: 'edge',
  maxDuration: 45,
};

// --- SDK INITIALIZATION ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_SECRET });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_TOKEN as string);
const deepseek = new OpenAI({ apiKey: process.env.DEEPSEEK_TOKEN, baseURL: 'https://api.deepseek.com/v1' });
const grok = new OpenAI({ apiKey: process.env.XAI_SECRET, baseURL: 'https://api.xai.com/v1' });

// --- INTERFACES ---
interface AnalysisRequest {
  scanType: 'barcode' | 'image' | 'vin';
  data: string;
  category_id: string;
  subcategory_id: string;
}

interface HydraResponse {
  itemName: string;
  estimatedValue: string;
  decision: 'BUY' | 'PASS';
  confidence: 'high' | 'medium' | 'low';
  analysisCount: number;
  consensusRatio: string;
  reasoning: string;
}

// --- HYDRA ENGINE CLASS ---
class HydraEngine {
    private async identifyProductByBarcode(barcode: string): Promise<any> {
        console.log(`🔍 Looking up barcode: ${barcode}`);
        return { title: `Product ${barcode}`, brand: 'Unknown', category: 'General Goods', upc: barcode };
    }
    
    private async runTextAnalysis(productData: any, prompt: string): Promise<any[]> {
        const analysisPromises = [
            anthropic.messages.create({
                model: 'claude-3-haiku-20240307', max_tokens: 1024,
                messages: [{ role: 'user', content: `${prompt} ${JSON.stringify(productData)}` }]
            }).then(res => res.content[0].text),

            openai.chat.completions.create({
                model: 'gpt-4-turbo', response_format: { type: "json_object" },
                messages: [{ role: 'user', content: `${prompt} ${JSON.stringify(productData)}` }]
            }).then(res => res.choices[0].message.content),

            genAI.getGenerativeModel({ model: "gemini-pro" }).generateContent(`${prompt} ${JSON.stringify(productData)}`)
                  .then(res => res.response.text()),
                  
            deepseek.chat.completions.create({
                model: 'deepseek-chat', response_format: { type: "json_object" },
                messages: [{ role: 'user', content: `${prompt} ${JSON.stringify(productData)}` }]
            }).then(res => res.choices[0].message.content),
            
            grok.chat.completions.create({
                model: 'grok-1', response_format: { type: "json_object" },
                messages: [{ role: 'user', content: `${prompt} ${JSON.stringify(productData)}` }]
            }).then(res => res.choices[0].message.content),
        ];

        return await this.processAnalysisResults(analysisPromises);
    }

    private async runImageAnalysis(imageData: string, prompt: string): Promise<any[]> {
        const analysisPromises = [
            anthropic.messages.create({
                model: 'claude-3-haiku-20240307', max_tokens: 1024,
                messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData.replace(/^data:image\/[a-z]+;base64,/, '') } }, { type: 'text', text: prompt }] }]
            }).then(res => res.content[0].text),
            
            openai.chat.completions.create({
                model: 'gpt-4-vision-preview', max_tokens: 800,
                messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageData } }] }]
            }).then(res => res.choices[0].message.content),
            
            genAI.getGenerativeModel({ model: "gemini-pro-vision" }).generateContent([prompt, { inlineData: { data: imageData.replace(/^data:image\/[a-z]+;base64,/, ''), mimeType: "image/jpeg" } }])
                  .then(res => res.response.text()),
        ];
        
        return await this.processAnalysisResults(analysisPromises);
    }
    
    private async processAnalysisResults(promises: Promise<string | null | undefined>[]): Promise<any[]> {
        const results = await Promise.allSettled(promises);
        const validAnalyses: any[] = [];

        results.forEach((result, i) => {
            if (result.status === 'fulfilled' && result.value) {
                try {
                    const jsonMatch = result.value.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        validAnalyses.push(JSON.parse(jsonMatch[0]));
                    }
                } catch (e) { console.error(`Error parsing JSON from AI service ${i}:`, e); }
            } else if (result.status === 'rejected') {
                 console.error(`API call failed for AI service ${i}:`, result.reason);
            }
        });
        
        return validAnalyses;
    }

    private buildConsensus(analyses: any[], itemName: string): HydraResponse {
        if (analyses.length === 0) {
            return { itemName, estimatedValue: '0.00', decision: 'PASS', confidence: 'low', analysisCount: 0, consensusRatio: '0/0', reasoning: 'No AI models were able to provide a valid analysis.' };
        }

        const buyVotes = analyses.filter(a => a.decision === 'BUY').length;
        const totalVotes = analyses.length;
        const values = analyses.map(a => parseFloat(a.estimatedValue) || 0).filter(v => v > 0);
        const avgValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (totalVotes >= 3) {
            const ratio = buyVotes / totalVotes;
            if (ratio >= 0.8 || ratio <= 0.2) confidence = 'high';
            else if (ratio >= 0.6 || ratio <= 0.4) confidence = 'medium';
        } else if (totalVotes > 0) {
            confidence = 'medium';
        }

        const decision = buyVotes > totalVotes / 2 ? 'BUY' : 'PASS';
        const reasoning = `Synthesized from ${totalVotes} AI models. ${analyses[0]?.reasoning || ''}`;

        return { itemName, estimatedValue: avgValue.toFixed(2), decision, confidence, analysisCount: totalVotes, consensusRatio: `${buyVotes}/${totalVotes}`, reasoning };
    }

    public async analyze(request: AnalysisRequest): Promise<HydraResponse> {
        const jsonPrompt = `Respond in JSON format only: {"itemName": "specific item name", "estimatedValue": "25.99", "decision": "BUY", "reasoning": "brief explanation"}`;
        let analyses: any[] = [];
        let itemName = "Analysis";

        if (request.scanType === 'image') {
            console.log('🖼️  Initiating Hydra image analysis...');
            const prompt = `You are an expert appraiser. Analyze this image of a collectible item. Identify it, estimate its resale value, and provide a BUY/PASS recommendation. ${jsonPrompt}`;
            analyses = await this.runImageAnalysis(request.data, prompt);
            itemName = analyses[0]?.itemName || "Image Analysis";
        } else if (request.scanType === 'barcode') {
            console.log('║█║ Initiating Hydra barcode analysis...');
            const productData = await this.identifyProductByBarcode(request.data);
            itemName = productData.title;
            const prompt = `You are an expert reseller. Analyze this product for arbitrage potential based on its data. ${jsonPrompt}`;
            analyses = await this.runTextAnalysis(productData, prompt);
        }
        
        console.log(`🤖 Consensus built from ${analyses.length} successful AI analyses.`);
        return this.buildConsensus(analyses, itemName);
    }
}

// --- API ROUTE HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await verifyUser(req); // SECURITY: Verify user authentication
        console.log(`Analysis request received for user: ${user.id}`);
        
        const body = req.body as AnalysisRequest;
        if (!body.scanType || !body.data || !body.category_id) {
            return res.status(400).json({ error: 'Missing required fields in analysis request.' });
        }

        const hydra = new HydraEngine();
        const analysisResult = await hydra.analyze(body);

        return res.status(200).json(analysisResult);
    } catch (error: any) {
        const message = error.message || 'An unknown error occurred.';
        if (message.includes('Authentication')) {
            return res.status(401).json({ error: message });
        }
        return res.status(500).json({ error: 'Hydra engine failed.', details: message });
    }
}