// FILE: api/analyze.ts
// STATUS: Surgically upgraded by Hephaestus to support Hydra v2.1 structured analysis.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { User } from '@supabase/supabase-js';
import { verifyUser } from './_lib/security';
import { dataSources, DataSource } from './_lib/datasources';

export const config = {
  runtime: 'edge',
  maxDuration: 45,
};

// --- SDK INITIALIZATION ---
const anthropic = new Anthropic({ apiKey: process.env.TIER1_ANTHROPIC_SECRET });
const genAI = new GoogleGenerativeAI(process.env.TIER1_GOOGLE_AI_TOKEN as string);
const openai = new OpenAI({ apiKey: process.env.TIER2_OPENAI_TOKEN });
const deepseek = new OpenAI({ apiKey: process.env.TIER2_DEEPSEEK_TOKEN, baseURL: 'https://api.deepseek.com/v1' });
const grok = new OpenAI({ apiKey: process.env.TIER2_XAI_SECRET, baseURL: 'https://api.xai.com/v1' });


// --- HEPHAESTUS v2.1 UPGRADE START ---
// The HydraResponse interface is updated to the new data contract for Nexus/Oracle.
interface HydraResponse {
  itemName: string;
  estimatedValue: string;
  decision: 'BUY' | 'PASS';
  confidence: 'high' | 'medium' | 'low';
  analysisCount: number;
  consensusRatio: string;
  summary_reasoning: string;       // Replaces the old 'reasoning' field.
  valuation_factors: string[];     // New structured list of key value drivers.
  resale_toolkit?: {
    sales_copy: string;
    recommended_marketplaces: DataSource[];
  };
}
// --- HEPHAESTUS v2.1 UPGRADE END ---


interface AnalysisRequest {
  scanType: 'barcode' | 'image' | 'vin';
  data: string;
  category_id: string;
  subcategory_id: string;
}

class HydraEngine {
    // --- UNCHANGED CODE ---
    private async identifyProductByBarcode(barcode: string): Promise<any> {
        console.log(`🔍 Looking up barcode: ${barcode}`);
        return { title: `Product ${barcode}`, brand: 'Unknown', category: 'General Goods', upc: barcode };
    }

    private async runTextAnalysis(productData: any, prompt: string): Promise<any[]> {
        const analysisPromises = [
            // Tier 1
            anthropic.messages.create({
                model: 'claude-3-haiku-20240307', max_tokens: 1024,
                messages: [{ role: 'user', content: `${prompt} ${JSON.stringify(productData)}` }]
            }).then(res => (res.content[0].type === 'text' ? res.content[0].text : null)),
            genAI.getGenerativeModel({ model: "gemini-pro" }).generateContent(`${prompt} ${JSON.stringify(productData)}`)
                  .then(res => res.response.text()),
            // Tier 2
            openai.chat.completions.create({
                model: 'gpt-4-turbo', response_format: { type: "json_object" },
                messages: [{ role: 'user', content: `${prompt} ${JSON.stringify(productData)}` }]
            }).then(res => res.choices[0].message.content),
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
             // Tier 1
            anthropic.messages.create({
                model: 'claude-3-haiku-20240307', max_tokens: 1024,
                messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData.replace(/^data:image\/[a-z]+;base64,/, '') } }, { type: 'text', text: prompt }] }]
            }).then(res => (res.content[0].type === 'text' ? res.content[0].text : null)),
            genAI.getGenerativeModel({ model: "gemini-pro-vision" }).generateContent([prompt, { inlineData: { data: imageData.replace(/^data:image\/[a-z]+;base64,/, ''), mimeType: "image/jpeg" } }])
                  .then(res => res.response.text()),
            // Tier 2
            openai.chat.completions.create({
                model: 'gpt-4-vision-preview', max_tokens: 800,
                messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageData } }] }]
            }).then(res => res.choices[0].message.content),
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
                        const parsed = JSON.parse(jsonMatch[0]);
                        // --- HEPHAESTUS v2.1 UPGRADE: Validate new structure ---
                        if (parsed.valuation_factors && Array.isArray(parsed.valuation_factors) && parsed.summary_reasoning) {
                           validAnalyses.push(parsed);
                        }
                    }
                } catch (e) { console.error(`Error parsing JSON from AI service ${i}:`, e); }
            } else if (result.status === 'rejected') {
                 console.error(`API call failed for AI service ${i}:`, result.reason);
            }
        });
        
        return validAnalyses;
    }

    // --- HEPHAESTUS v2.1 UPGRADE: Reforged Consensus Logic ---
    private buildConsensus(analyses: any[], itemName: string): HydraResponse {
        if (analyses.length === 0) {
            return { itemName, estimatedValue: '0.00', decision: 'PASS', confidence: 'low', analysisCount: 0, consensusRatio: '0/0', summary_reasoning: 'No AI models were able to provide a valid analysis.', valuation_factors: [] };
        }

        const buyVotes = analyses.filter(a => a.decision === 'BUY').length;
        const totalVotes = analyses.length;
        const values = analyses.map(a => parseFloat(a.estimatedValue) || 0).filter(v => v > 0);
        const avgValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        
        const factorCounts = new Map<string, number>();
        analyses.flatMap(a => a.valuation_factors).forEach(factor => {
            factorCounts.set(factor, (factorCounts.get(factor) || 0) + 1);
        });
        const sortedFactors = Array.from(factorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (totalVotes >= 3) {
            const ratio = buyVotes / totalVotes;
            if (ratio >= 0.8 || ratio <= 0.2) confidence = 'high';
            else if (ratio >= 0.6 || ratio <= 0.4) confidence = 'medium';
        } else if (totalVotes > 0) {
            confidence = 'medium';
        }

        const decision = buyVotes > totalVotes / 2 ? 'BUY' : 'PASS';
        const summary_reasoning = `Synthesized from ${totalVotes} AI models. ${analyses[0]?.summary_reasoning || 'No summary available.'}`;

        return { itemName, estimatedValue: avgValue.toFixed(2), decision, confidence, analysisCount: totalVotes, consensusRatio: `${buyVotes}/${totalVotes}`, summary_reasoning, valuation_factors: sortedFactors.slice(0, 5) };
    }
    // --- END UPGRADE ---
    
    // --- UNCHANGED CODE ---
    private getMarketplaceRecommendations(category_id: string, subcategory_id: string): DataSource[] {
        const categoryData = dataSources.find(ds => ds.category_id === category_id && ds.subcategory_id === subcategory_id);
        if (!categoryData) {
            return [];
        }
    
        return [...categoryData.tier_1_sources, ...categoryData.tier_2_sources, ...categoryData.tier_3_sources]
            .filter(source => source.api_available && source.affiliate_link_template)
            .slice(0, 5);
    }
    
    // --- HEPHAESTUS v2.1 UPGRADE: Enhanced Sales Copy Prompt ---
    private async generateSalesCopy(analysisResult: HydraResponse): Promise<string> {
        const prompt = `You are an expert e-commerce copywriter. Based on the following analysis, write a compelling, SEO-friendly sales description for this item. Use the 'Key Value Drivers' to structure the description and highlight the most important features.
    
        Item Name: ${analysisResult.itemName}
        Estimated Value: $${analysisResult.estimatedValue}
        Key Value Drivers: ${analysisResult.valuation_factors.join(', ')}`;
    
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo',
                messages: [{ role: 'user', content: prompt }]
            });
            return response.choices[0].message.content || 'Error generating sales copy.';
        } catch (error) {
            console.error('Error generating sales copy:', error);
            return 'Error generating sales copy.';
        }
    }
    // --- END UPGRADE ---
    
    public async analyze(request: AnalysisRequest): Promise<HydraResponse> {
        // --- HEPHAESTUS v2.1 UPGRADE: New AI Prompt ---
        const jsonPrompt = `Analyze the item. Respond in JSON format ONLY: {"itemName": "specific name", "estimatedValue": "25.99", "decision": "BUY", "valuation_factors": ["Factor 1", "Factor 2", "Factor 3", "Factor 4", "Factor 5"], "summary_reasoning": "A brief summary."}`;
        
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
        
        const consensus = this.buildConsensus(analyses, itemName);
        
        const sales_copy = await this.generateSalesCopy(consensus);
        const recommended_marketplaces = this.getMarketplaceRecommendations(request.category_id, request.subcategory_id);
        
        consensus.resale_toolkit = {
            sales_copy,
            recommended_marketplaces
        };
        
        return consensus;
    }
}

// --- API ROUTE HANDLER (Unchanged by Apollo) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await verifyUser(req);
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
}}

