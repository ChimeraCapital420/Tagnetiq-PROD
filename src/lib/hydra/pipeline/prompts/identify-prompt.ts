// FILE: src/lib/hydra/pipeline/prompts/identify-prompt.ts
// HYDRA v9.1 - Stage 1 Prompt: IDENTIFY
// Simplified for reliable parsing across all providers
//
// v9.0: Complex prompt with many optional fields — parsers rejected responses
// v9.1: Minimal required fields, examples for each category, explicit JSON format

export function buildIdentifyPrompt(context?: {
  itemNameHint?: string;
  categoryHint?: string;
}): string {
  let prompt = IDENTIFY_SYSTEM_PROMPT;
  
  if (context?.categoryHint) {
    prompt += `\n\nCategory hint: ${context.categoryHint}. Verify this matches what you see.`;
  }
  
  if (context?.itemNameHint) {
    prompt += `\n\nUser described item as: "${context.itemNameHint}". Verify against the image.`;
  }
  
  return prompt;
}

const IDENTIFY_SYSTEM_PROMPT = `Identify this item from the image. Be as SPECIFIC as possible.

Respond with ONLY valid JSON, no markdown, no backticks, no explanation:

{
  "itemName": "Full specific name with year, edition, variant, issue number, author, etc.",
  "category": "category_from_list_below",
  "condition": "mint | near_mint | excellent | good | fair | poor",
  "description": "Brief 1-2 sentence description of what you see",
  "confidence": 0.85,
  "estimatedValue": 25,
  "decision": "BUY",
  "valuation_factors": ["Identified from image", "Condition assessed visually"],
  "summary_reasoning": "Brief identification reasoning"
}

IDENTIFICATION EXAMPLES:
- Comic book → "Star Wars: The Empire Strikes Back #18 (Marvel Comics, 1978)"
- Coin → "1921 Morgan Silver Dollar, Philadelphia Mint, VF condition"
- Pokemon card → "Charizard #4/102 Base Set Holo Rare, 1999 WOTC"
- Book → "The Grapes of Wrath by John Steinbeck, First Edition, 1939, Viking Press"
- LEGO → "LEGO Star Wars Millennium Falcon #75192, Sealed"
- Sports card → "1986 Fleer Michael Jordan #57 Rookie Card"
- Vinyl → "Pink Floyd - Dark Side of the Moon, 1973 UK First Press, Harvest Records"
- Watch → "Omega Speedmaster Professional Moonwatch Ref. 311.30.42.30.01.005"
- Video game → "The Legend of Zelda: Ocarina of Time, N64, CIB"
- Toy → "1977 Kenner Star Wars Boba Fett Action Figure, Loose"
- Stamp → "US 1918 Inverted Jenny 24c Airmail, Scott #C3a"
- Vehicle → "2024 Ford F-150 XLT SuperCrew 4x4 VIN: 1FTFW1E50MFA12345"

CATEGORIES:
coins, stamps, banknotes, pokemon_cards, trading_cards, sports_cards,
lego, books, vinyl_records, sneakers, watches, jewelry, toys, figurines,
video_games, comics, art, antiques, vehicles, electronics, clothing,
musical_instruments, wine, spirits, collectibles, household, general

RULES:
1. itemName must be SPECIFIC — include issue numbers, years, editions, variants, authors
2. estimatedValue should be your rough estimate (even approximate is fine, just not 0)
3. Extract ANY visible identifiers and include them in itemName (ISBNs, VINs, serial numbers, issue numbers)
4. For graded/slabbed items, include the grade (PSA 9, BGS 9.5, CGC 9.8)
5. NEVER return generic names like "Comic Book" or "Old Coin" — always be specific
6. Respond with ONLY the JSON object — no other text`;