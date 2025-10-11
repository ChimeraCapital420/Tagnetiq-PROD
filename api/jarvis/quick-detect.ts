// api/jarvis/quick-detect.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { image, mode, context } = await req.json();

    // Use Gemini Flash for ultra-fast object detection
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a rapid object detector for collectibles and valuable items.
    ${context ? `Environment: ${context}` : ''}
    
    Quickly identify ALL potentially valuable objects in this image.
    For each object, provide:
    1. Description (brief, specific)
    2. Category (watches, coins, stamps, trading-cards, comics, jewelry, art, memorabilia, other)
    3. Confidence (0-100)
    4. Estimated value tier (low: <$50, medium: $50-500, high: $500-5000, premium: >$5000)
    
    Respond in JSON format:
    {
      "objects": [
        {
          "description": "Rolex Submariner watch",
          "category": "watches",
          "confidence": 85,
          "valueTier": "premium",
          "boundingBox": { "x": 100, "y": 200, "width": 150, "height": 200 }
        }
      ]
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: image
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed.objects || []);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Quick detect error:', error);
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 });
  }
}