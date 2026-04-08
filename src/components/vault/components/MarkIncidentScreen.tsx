// FILE: src/components/vault/components/MarkIncidentScreen.tsx
// Shared screen for both "Mark Lost" and "Mark Damaged"
import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { XCircle, AlertOctagon, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import type { VaultItem, IncidentDetails } from '../types';

interface MarkIncidentScreenProps {
  type: 'lost' | 'damaged';
  selectedItems: VaultItem[];
  totalValue: number;
  incidentDetails: IncidentDetails;
  isProcessing: boolean;
  onIncidentDetailsChange: (details: IncidentDetails) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function MarkIncidentScreen({
  type,
  selectedItems,
  totalValue,
  incidentDetails,
  isProcessing,
  onIncidentDetailsChange,
  onConfirm,
  onBack,
}: MarkIncidentScreenProps) {
  const isLost = type === 'lost';
  const Icon = isLost ? XCircle : AlertOctagon;
  const colorClass = isLost ? 'yellow' : 'orange';

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 text-${colorClass}-500`} />
              Mark as {isLost ? 'Lost' : 'Damaged'}
            </DialogTitle>
            <DialogDescription>
              Document {isLost ? 'loss' : 'damage'} for {selectedItems.length} item(s)
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className={`bg-${colorClass}-500/10 border border-${colorClass}-500/20 rounded-lg p-3`}>
        <div className="flex flex-wrap gap-1">
          {selectedItems.slice(0, 3).map(item => (
            <Badge key={item.id} variant="outline" className={`text-xs border-${colorClass}-500/30`}>
              {item.asset_name.length > 15 ? item.asset_name.substring(0, 15) + '...' : item.asset_name}
            </Badge>
          ))}
          {selectedItems.length > 3 && (
            <Badge variant="outline" className="text-xs">+{selectedItems.length - 3} more</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="incidentDate">Date</Label>
          <Input
            id="incidentDate"
            type="date"
            value={incidentDetails.date}
            onChange={(e) => onIncidentDetailsChange({ ...incidentDetails, date: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder={isLost ? 'How/where was the item lost?' : 'Describe the damage...'}
            value={incidentDetails.description}
            onChange={(e) => onIncidentDetailsChange({ ...incidentDetails, description: e.target.value })}
            rows={3}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="insuranceClaim"
              checked={incidentDetails.insuranceClaim}
              onCheckedChange={(c) => onIncidentDetailsChange({ ...incidentDetails, insuranceClaim: !!c })}
            />
            <Label htmlFor="insuranceClaim" className="cursor-pointer">Filing insurance claim</Label>
          </div>
          {incidentDetails.insuranceClaim && (
            <Input
              placeholder="Claim number"
              value={incidentDetails.claimNumber}
              onChange={(e) => onIncidentDetailsChange({ ...incidentDetails, claimNumber: e.target.value })}
            />
          )}

          {isLost && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="policeReport"
                  checked={incidentDetails.policeReport}
                  onCheckedChange={(c) => onIncidentDetailsChange({ ...incidentDetails, policeReport: !!c })}
                />
                <Label htmlFor="policeReport" className="cursor-pointer">Filed police report</Label>
              </div>
              {incidentDetails.policeReport && (
                <Input
                  placeholder="Report number"
                  value={incidentDetails.reportNumber}
                  onChange={(e) => onIncidentDetailsChange({ ...incidentDetails, reportNumber: e.target.value })}
                />
              )}
            </>
          )}
        </div>

        {totalValue > 0 && (
          <div className={`bg-${colorClass}-500/10 border border-${colorClass}-500/30 rounded-lg p-3`}>
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className={`h-4 w-4 text-${colorClass}-500`} />
              Value at risk: ${totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Consider exporting a PDF report first for insurance purposes.
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={onConfirm}
        disabled={isProcessing}
        className={`w-full ${isLost ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-orange-600 hover:bg-orange-700'}`}
      >
        {isProcessing
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
          : <><Icon className="mr-2 h-4 w-4" />Confirm {isLost ? 'Lost' : 'Damaged'}</>
        }
      </Button>
    </>
  );
}