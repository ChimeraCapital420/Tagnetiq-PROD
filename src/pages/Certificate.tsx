// FILE: src/pages/Certificate.tsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert } from 'lucide-react';

interface CertificateData {
  id: string;
  asset_name: string;
  photos: string[];
  valuation_data: any;
  owner_valuation?: number;
  created_at: string;
  users: {
    email: string;
  };
}

const CertificatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<CertificateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No asset ID provided.');
      setIsLoading(false);
      return;
    }

    const fetchCertificate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/vault/certificate/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Could not load asset certificate.');
        }
        const data = await response.json();
        setAsset(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificate();
  }, [id]);
  
  const displayValue = asset?.owner_valuation 
    ? asset.owner_valuation.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : asset?.valuation_data?.estimatedValue
      ? `$${parseFloat(asset.valuation_data.estimatedValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Not Valued';

  const valueSource = asset?.owner_valuation ? "Owner Declared Value" : "AI Estimated Value";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
            <div className="flex justify-center items-center mb-4">
                <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-12 w-auto" />
            </div>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Asset Certificate</CardTitle>
                    <CardDescription>This document certifies the details of the specified asset as recorded in the Tagnetiq Aegis Vault.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">Loading secure certificate...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-12 text-destructive">
                        <ShieldAlert className="h-8 w-8" />
                        <p className="mt-4 font-semibold">{error}</p>
                    </div>
                ) : asset ? (
                    <div className="space-y-6">
                        <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                            <img src={asset.photos?.[0] || '/placeholder.svg'} alt={asset.asset_name} className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{asset.asset_name}</h2>
                            <p className="text-sm text-muted-foreground mt-2">
                                Added to vault on {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Declared Value</p>
                                <p className="text-xl font-bold">{displayValue}</p>
                            </div>
                             <div>
                                <p className="text-sm font-medium text-muted-foreground">Valuation Method</p>
                                <Badge variant="outline">{valueSource}</Badge>
                            </div>
                        </div>
                    </div>
                ) : null}
                </CardContent>
            </Card>
            <p className="text-xs text-center text-muted-foreground mt-4">
                This certificate is a record of data provided by the user and/or Tagnetiq AI analysis. For verification, please contact the asset owner directly.
            </p>
        </div>
    </div>
  );
};

export default CertificatePage;
