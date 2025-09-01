// FILE: src/components/investor/CallToAction.tsx (REPLACE ENTIRE FILE)

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export const CallToAction: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    company: '',
    message: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) {
      toast.error('Please provide at least your full name and email.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/investor/request-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      // --- FIX START: Properly handle the JSON response ---
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.');
      }
      // --- FIX END ---

      toast.success('Request Submitted!', {
        description: 'Thank you for your interest. We will be in touch shortly.',
      });
      setFormData({ fullName: '', email: '', company: '', message: '' }); // Reset form
      setOpen(false); // Close the dialog

    } catch (error) {
      toast.error('Submission Failed', { description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-primary/10 border-primary/20">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Ready to Invest in the Future of Asset Intelligence?</CardTitle>
        <CardDescription>
          Take the next step. Request a private meeting with our founding team to discuss investment opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">Request Private Investment Meeting</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Request a Meeting</DialogTitle>
              <DialogDescription>
                Submit your details below, and a member of our team will contact you to schedule a private briefing.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fullName" className="text-right">Full Name</Label>
                  <Input id="fullName" value={formData.fullName} onChange={handleInputChange} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="company" className="text-right">Company</Label>
                  <Input id="company" value={formData.company} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="message" className="text-right">Message</Label>
                  <Textarea id="message" value={formData.message} onChange={handleInputChange} className="col-span-3" placeholder="(Optional)" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};