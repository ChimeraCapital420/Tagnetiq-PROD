// FILE: src/components/beta/TriageTable.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Feedback } from '@/types/beta';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const TriageTable: React.FC = () => {
  const [feedbackItems, setFeedbackItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setFeedbackItems(data || []);
      } catch (error) {
        toast.error('Failed to load feedback.', { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      
      setFeedbackItems(items => items.map(item => item.id === id ? { ...item, status: newStatus } : item));
      toast.success('Feedback status updated.');
    } catch (error) {
      toast.error('Failed to update status.', { description: (error as Error).message });
    }
  };
  
  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) return <p>Loading feedback...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback Triage</CardTitle>
        <CardDescription>Review and manage all beta tester feedback.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbackItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Select value={item.status} onValueChange={(newStatus) => handleStatusChange(item.id, newStatus)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="fix_in_progress">In Progress</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="max-w-[300px] truncate">{item.message}</TableCell>
                <TableCell>
                  <Badge variant={getSeverityBadge(item.severity)}>{item.severity}</Badge>
                </TableCell>
                <TableCell>{item.app_version}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};