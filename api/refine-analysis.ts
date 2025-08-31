// api/refine-analysis.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { AnalysisResult } from '../src/types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialize AI Clients ---
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const googleModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest"});


/**
 * A helper function to safely parse a JSON string from an AI response.
 * @param jsonString The string to parse.
 * @returns The parsed object or null if parsing fails.
 */
const safeJsonParse = (jsonString: string) => {
  try {
    // Clean the string: remove ```json markdown and any leading/trailing whitespace
    const cleanedString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("JSON parsing failed for string:", jsonString);
    return null;
  }
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { original_analysis, refinement_text } = req.body;

    if (!original_analysis || !refinement_text) {
      return res.status(400).json({ error: 'Missing original_analysis or refinement_text in request body.' });
    }

    const analysis: AnalysisResult = original_analysis;

    // --- Dynamic Multi-AI Consensus Prompt ---
    const prompt = `
      You are an expert appraiser. Given the following item analysis and a new piece of information from the user, your task is to provide an adjusted valuation and updated valuation factors.

      Original Item Analysis:
      - Item: ${analysis.itemName}
      - Original Estimated Value: $${analysis.estimatedValue.toFixed(2)}
      - Original Key Valuation Factors: ${analysis.valuation_factors.join('; ')}
      - Original Summary: ${analysis.summary_reasoning}

      New Information Provided by User: "${refinement_text}"

      Your Task:
      1.  Analyze how the new information impacts the item's value.
      2.  Determine a new, adjusted estimated value as a single number.
      3.  Create a new, updated list of the top 5 key valuation factors. The new information MUST be reflected as one of these factors.
      4.  Generate a new, concise summary_reasoning that incorporates the user's refinement.

      Respond ONLY with a valid JSON object in the following format, with no other text or explanation.
      {
        "newValue": <number>,
        "newFactors": ["<factor 1>", "<factor 2>", "<factor 3>", "<factor 4>", "<factor 5>"],
        "newSummary": "<string>"
      }
    `;

    // --- Execute Parallel AI Calls ---
    const aiPromises = [
      // Anthropic Call
      anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }).then(response => safeJsonParse(response.content[0].text)),

      // OpenAI Call
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }).then(response => safeJsonParse(response.choices[0].message.content!)),

      // Google Gemini Call
      googleModel.generateContent(prompt)
        .then(response => safeJsonParse(response.response.text())),
    ];

    const results = await Promise.allSettled(aiPromises);

    const successfulResponses = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);
    
    if (successfulResponses.length === 0) {
        console.error("All AI API calls failed or returned invalid data.", results);
        throw new Error("Unable to get a valid response from any AI model.");
    }

    // --- Aggregate and Average the Results (Judicium Consensus) ---
    const totalValue = successfulResponses.reduce((acc, curr) => acc + (curr.newValue || 0), 0);
    const averageValue = totalValue / successfulResponses.length;

    const allFactors = successfulResponses.flatMap(res => res.newFactors || []);
    const uniqueFactors = [...new Set(allFactors)];

    // For simplicity, we'll take the summary from the first successful response.
    const newSummary = successfulResponses[0].newSummary || `Value adjusted based on user feedback. ${analysis.summary_reasoning}`;

    // --- Construct Final Updated Analysis ---
    const updatedAnalysis: AnalysisResult = {
      ...analysis,
      estimatedValue: averageValue,
      valuation_factors: uniqueFactors.slice(0, 5), // Take top 5 unique factors
      summary_reasoning: newSummary,
    };

    return res.status(200).json(updatedAnalysis);

  } catch (error) {
    console.error('Error in /api/refine-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}