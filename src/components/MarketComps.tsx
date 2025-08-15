import React, { useState, useEffect } from 'react';
// CORRECTED: Added all the missing Card component imports.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Comp {
  id: number;
  address: string;
  value: number;
  sqft: number;
  beds: number;
  baths: number;
}

interface ApiResponse {
  status: string;
  comps: Comp[];
}

const MarketComps: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComps = async () => {
      try {
        const response = await fetch('/api/market-comps');
        if (!response.ok) {
          throw new Error('Failed to fetch market comps.');
        }
        const result: ApiResponse = await response.json();
        setData(result);
        if (result.status !== 'live') {
            toast.info("Displaying placeholder data", {
                description: result.status,
            });
        }
      } catch (error) {
        toast.error("Error loading data", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };

    fetchComps();
  }, []);

  if (loading) {
    return <p>Loading market comps...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Real Estate Market Comps</CardTitle>
                <CardDescription>Comparable properties based on your scan.</CardDescription>
            </div>
            {data?.status.includes('Awaiting') && <Badge variant="destructive">DEMO MODE</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Sq. Ft.</TableHead>
              <TableHead className="text-right">Beds</TableHead>
              <TableHead className="text-right">Baths</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.comps.map((comp) => (
              <TableRow key={comp.id}>
                <TableCell className="font-medium">{comp.address}</TableCell>
                <TableCell className="text-right">${comp.value.toLocaleString()}</TableCell>
                <TableCell className="text-right">{comp.sqft.toLocaleString()}</TableCell>
                <TableCell className="text-right">{comp.beds}</TableCell>
                <TableCell className="text-right">{comp.baths}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MarketComps;