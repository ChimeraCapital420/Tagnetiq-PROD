// FILE: src/components/admin/investor/InvestorInviteForm.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, X } from 'lucide-react'; // Import X icon

export const InvestorInviteForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- MODIFICATION START ---
  // State to hold the generated QR code and link
  const [generatedData, setGeneratedData] = useState<{ qrCode: string; link: string } | null>(null);
  // --- MODIFICATION END ---

  const handleInvite = async () => {
    if (!email || !name) {
      toast.error('Please enter the investor\'s name and email.');
      return;
    }
    setIsLoading(true);
    setGeneratedData(null); // Clear previous results

    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

    try {
      const response = await fetch('/api/investor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, expires_at, mode }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to send invite.');
      }
      
      const { signedUrl, qrCodeDataUrl } = await response.json();
      
      // --- MODIFICATION START ---
      // Set the generated data to state to display it
      setGeneratedData({ qrCode: qrCodeDataUrl, link: signedUrl });
      toast.success('Investor Invite Generated!', {
        description: `A unique link and QR code have been created for ${name}.`,
      });
      // --- MODIFICATION END ---

      // Reset form
      setName('');
      setEmail('');
    } catch (error) {
      toast.error('Invite Failed', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- MODIFICATION START ---
  // Function to handle copying the link
  const handleCopyLink = () => {
    if (generatedData?.link) {
      navigator.clipboard.writeText(generatedData.link);
      toast.success('Link copied to clipboard!');
    }
  };
  // --- MODIFICATION END ---

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite New Investor</CardTitle>
        <CardDescription>Generate a secure, tracked link and QR code for a potential investor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* --- MODIFICATION START --- */}
        {/* Conditionally render the results or the form */}
        {generatedData ? (
          <div className="flex flex-col items-center gap-4 text-center p-4 border rounded-lg">
              <img src={generatedData.qrCode} alt="Investor QR Code" className="w-48 h-48 rounded-md bg-gray-100" />
              <div className="flex w-full">
                  <Input readOnly value={generatedData.link} className="text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink} className="ml-2">
                      <Copy className="h-4 w-4" />
                  </Button>
              </div>
              <Button onClick={() => setGeneratedData(null)} className="w-full">
                  <X className="mr-2 h-4 w-4" /> Create Another Invite
              </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="investor-name">Name</Label>
                <Input id="investor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investor-email">Email</Label>
                <Input id="investor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane.doe@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Portal Mode</Label>
              <Select onValueChange={(value: 'demo' | 'live') => setMode(value)} defaultValue="demo">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo Data</SelectItem>
                  <SelectItem value="live">Live Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInvite} disabled={isLoading} className="w-full">
              {isLoading ? 'Generating Link...' : 'Generate Secure Invite Link'}
            </Button>
          </>
        )}
        {/* --- MODIFICATION END --- */}
      </CardContent>
    </Card>
  );
};