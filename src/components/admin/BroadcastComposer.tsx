// FILE: src/components/admin/BroadcastComposer.tsx
// Admin UI to compose and send a broadcast message to all users.
// Displays inside admin panel — guarded by is_admin check on the parent page.
//
// Workflow:
//   1. Admin types title (optional) + body (required)
//   2. Clicks "Preview" — runs dry-run to confirm recipient count
//   3. Reviews and confirms
//   4. Clicks "Send Broadcast" — posts to /api/admin/broadcast
//   5. Toast confirms success/failure with recipient counts

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Send, Users, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const MAX_TITLE = 200;
const MAX_BODY = 5000;

interface PreviewResult {
  recipientCount: number;
  bodyPreview: string;
  titlePreview: string | null;
}

const BroadcastComposer: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmedReady, setConfirmedReady] = useState(false);

  const titleRemaining = MAX_TITLE - title.length;
  const bodyRemaining = MAX_BODY - body.length;
  const canPreview = body.trim().length > 0 && body.length <= MAX_BODY && title.length <= MAX_TITLE;
  const canSend = !!preview && confirmedReady && !sending;

  const callBroadcast = async (dryRun: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You must be logged in');
      return null;
    }

    const response = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        title: title.trim() || undefined,
        body: body.trim(),
        excludeAdmins,
        dryRun,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  const handlePreview = async () => {
    if (!canPreview) return;
    setPreviewing(true);
    setPreview(null);
    setConfirmedReady(false);

    try {
      const result = await callBroadcast(true);
      if (result) {
        setPreview({
          recipientCount: result.recipientCount,
          bodyPreview: result.bodyPreview,
          titlePreview: result.titlePreview,
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);

    try {
      const result = await callBroadcast(false);
      if (result?.success) {
        toast.success(result.message || 'Broadcast sent', {
          description: `${result.successCount} delivered, ${result.failureCount} failed`,
        });
        // Reset form
        setTitle('');
        setBody('');
        setExcludeAdmins(false);
        setPreview(null);
        setConfirmedReady(false);
      } else {
        toast.warning(result?.message || 'Broadcast completed with issues');
      }
    } catch (error: any) {
      toast.error(error.message || 'Broadcast failed');
    } finally {
      setSending(false);
    }
  };

  // When user edits content, invalidate the preview so they can't send stale
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (preview) {
      setPreview(null);
      setConfirmedReady(false);
    }
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (preview) {
      setPreview(null);
      setConfirmedReady(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Broadcast Message
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Send a message from <strong>TagnetIQ Official</strong> to all active users.
          Each user receives it in their direct inbox conversation with the platform.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="broadcast-title">Title (optional)</Label>
            <span className={`text-xs ${titleRemaining < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {titleRemaining} chars left
            </span>
          </div>
          <Input
            id="broadcast-title"
            placeholder="e.g. New feature: StyleScan is live"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            maxLength={MAX_TITLE + 50}
            disabled={sending}
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="broadcast-body">
              Message <span className="text-red-500">*</span>
            </Label>
            <span className={`text-xs ${bodyRemaining < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {bodyRemaining} chars left
            </span>
          </div>
          <Textarea
            id="broadcast-body"
            placeholder="Write your announcement here. Markdown is supported (bold with **, lists with -, etc.)"
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            rows={8}
            disabled={sending}
            className="font-mono text-sm"
          />
        </div>

        {/* Options */}
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="exclude-admins"
            checked={excludeAdmins}
            onCheckedChange={(c) => setExcludeAdmins(c === true)}
            disabled={sending}
          />
          <Label htmlFor="exclude-admins" className="text-sm font-normal cursor-pointer">
            Exclude other admins from this broadcast
          </Label>
        </div>

        {/* Preview Action */}
        {!preview && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handlePreview}
              disabled={!canPreview || previewing}
              variant="outline"
            >
              {previewing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Counting recipients...</>
              ) : (
                <><Users className="h-4 w-4 mr-2" /> Preview &amp; Count Recipients</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              No messages are sent until you confirm.
            </span>
          </div>
        )}

        {/* Preview Result */}
        {preview && (
          <Alert className="bg-amber-500/5 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="space-y-3">
              <div>
                You are about to send this broadcast to{' '}
                <Badge variant="secondary" className="font-mono">
                  {preview.recipientCount} {preview.recipientCount === 1 ? 'user' : 'users'}
                </Badge>
              </div>

              <div className="rounded-md bg-background p-3 border space-y-2">
                {preview.titlePreview && (
                  <div className="font-bold text-sm">{preview.titlePreview}</div>
                )}
                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {preview.bodyPreview}
                  {body.length > preview.bodyPreview.length && '...'}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="confirm-send"
                  checked={confirmedReady}
                  onCheckedChange={(c) => setConfirmedReady(c === true)}
                  disabled={sending}
                />
                <Label htmlFor="confirm-send" className="text-sm font-normal cursor-pointer">
                  I have reviewed the message and want to send it now.
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="bg-primary hover:bg-primary/90"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Send Broadcast Now</>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setPreview(null);
                    setConfirmedReady(false);
                  }}
                  variant="ghost"
                  disabled={sending}
                >
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Honest disclaimer */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-500" />
            <span>
              Broadcasts are stored as private direct messages. Users see them in their normal inbox
              from <strong>TagnetIQ Official</strong>. They can reply — replies route back to the
              system inbox, which admins can review.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BroadcastComposer;