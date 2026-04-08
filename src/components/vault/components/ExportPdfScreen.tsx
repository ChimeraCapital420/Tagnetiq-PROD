// FILE: src/components/vault/components/ExportPdfScreen.tsx
import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, Download, DollarSign, Shield, Image as ImageIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VaultItem, PdfOptions } from '../types';

interface ExportPdfScreenProps {
  selectedItems: VaultItem[];
  totalValue: number;
  pdfOptions: PdfOptions;
  isProcessing: boolean;
  onPdfOptionsChange: (options: PdfOptions) => void;
  onExport: () => void;
  onBack: () => void;
}

export function ExportPdfScreen({
  selectedItems,
  totalValue,
  pdfOptions,
  isProcessing,
  onPdfOptionsChange,
  onExport,
  onBack,
}: ExportPdfScreenProps) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Export PDF Report
            </DialogTitle>
            <DialogDescription>
              {selectedItems.length} item(s) • ${totalValue.toLocaleString()} total value
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">Exporting:</p>
        <div className="flex flex-wrap gap-1">
          {selectedItems.slice(0, 5).map(item => (
            <Badge key={item.id} variant="secondary" className="text-xs">
              {item.asset_name.length > 20 ? item.asset_name.substring(0, 20) + '...' : item.asset_name}
            </Badge>
          ))}
          {selectedItems.length > 5 && (
            <Badge variant="outline" className="text-xs">+{selectedItems.length - 5} more</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Report Format</Label>
          <RadioGroup
            value={pdfOptions.format}
            onValueChange={(v) => onPdfOptionsChange({ ...pdfOptions, format: v as PdfOptions['format'] })}
            className="grid grid-cols-3 gap-2"
          >
            {(['detailed', 'summary', 'insurance'] as const).map((fmt) => (
              <div
                key={fmt}
                className={cn(
                  'border rounded-lg p-3 cursor-pointer transition-colors',
                  pdfOptions.format === fmt ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
              >
                <RadioGroupItem value={fmt} id={fmt} className="sr-only" />
                <Label htmlFor={fmt} className="cursor-pointer">
                  <div className="font-medium capitalize">{fmt}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmt === 'detailed' ? 'Full information' : fmt === 'summary' ? 'Quick overview' : 'Claims ready'}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <Label>Include in Report</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'includePhotos', label: 'Photos', Icon: ImageIcon },
              { key: 'includeValuations', label: 'Valuations', Icon: DollarSign },
              { key: 'includeNotes', label: 'Notes & Serial #', Icon: FileText },
              { key: 'includeProvenance', label: 'Provenance', Icon: Shield },
            ].map(({ key, label, Icon }) => (
              <div key={key} className="flex items-center space-x-2 border rounded-lg p-2 hover:bg-muted/30 transition-colors">
                <Checkbox
                  id={key}
                  checked={pdfOptions[key as keyof PdfOptions] as boolean}
                  onCheckedChange={(c) => onPdfOptionsChange({ ...pdfOptions, [key]: !!c })}
                />
                <Label htmlFor={key} className="flex items-center gap-2 cursor-pointer flex-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={onExport} disabled={isProcessing} className="w-full">
        {isProcessing
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
          : <><Download className="mr-2 h-4 w-4" />Download PDF Report</>
        }
      </Button>
    </>
  );
}