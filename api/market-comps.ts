import type { VercelRequest, VercelResponse } from '@vercel/node';

interface MarketCompsResponse {
  address: string | undefined;
  zestimate: number | null;
  redfinEstimate: number | null;
  status: string;
  comps: Array<{
    address: string;
    price: number;
    sqft: number;
    beds: number;
    baths: number;
    soldDate: string;
  }>;
}

export default function handler(
  req: VercelRequest, 
  res: VercelResponse<MarketCompsResponse>
) {
  const mockData: MarketCompsResponse = {
    address: req.query?.address as string | undefined,
    zestimate: null,
    redfinEstimate: null,
    status: "Awaiting API key configuration",
    comps: []
  };
  
  res.status(200).json(mockData);
}