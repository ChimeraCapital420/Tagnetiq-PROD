// FILE: src/components/vault/VaultExportModal.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Download,
  DollarSign,
  AlertTriangle,
  Trash2,
  Package,
  CheckSquare,
  Square,
  Loader2,
  Image as ImageIcon,
  ShoppingBag,
  XCircle,
  AlertOctagon,
  ChevronRight,
  ArrowLeft,
  Calendar,
  User,
  FileCheck,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { VaultItem } from '@/pages/Vault';

interface VaultExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: VaultItem[];
  vaultName: string;
  selectedItemIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onItemsUpdated: () => void;
  session: { access_token: string } | null;
}

type ActionScreen = 'select' | 'export-pdf' | 'mark-sold' | 'mark-lost' | 'mark-damaged' | 'delete';

export const VaultExportModal: React.FC<VaultExportModalProps> = ({
  isOpen,
  onClose,
  items,
  vaultName,
  selectedItemIds,
  onSelectionChange,
  onItemsUpdated,
  session
}) => {
  const [currentScreen, setCurrentScreen] = useState<ActionScreen>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // PDF Options
  const [pdfOptions, setPdfOptions] = useState({
    includePhotos: true,
    includeValuations: true,
    includeNotes: true,
    includeProvenance: true,
    format: 'detailed' as 'detailed' | 'summary' | 'insurance'
  });

  // Sale details
  const [saleDetails, setSaleDetails] = useState({
    salePrice: '',
    saleDate: new Date().toISOString().split('T')[0],
    buyerInfo: '',
    platform: '',
    notes: ''
  });

  // Lost/Damaged details
  const [incidentDetails, setIncidentDetails] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    insuranceClaim: false,
    claimNumber: '',
    policeReport: false,
    reportNumber: ''
  });

  const selectedItems = items.filter(item => selectedItemIds.includes(item.id));
  
  const totalValue = selectedItems.reduce((sum, item) => {
    const val = item.valuation_data?.estimatedValue;
    if (val) {
      const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }
    return sum;
  }, 0);

  const toggleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(item => item.id));
    }
  };

  const toggleItem = (itemId: string) => {
    if (selectedItemIds.includes(itemId)) {
      onSelectionChange(selectedItemIds.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItemIds, itemId]);
    }
  };

  const resetAndClose = () => {
    setCurrentScreen('select');
    setSaleDetails({
      salePrice: '',
      saleDate: new Date().toISOString().split('T')[0],
      buyerInfo: '',
      platform: '',
      notes: ''
    });
    setIncidentDetails({
      date: new Date().toISOString().split('T')[0],
      description: '',
      insuranceClaim: false,
      claimNumber: '',
      policeReport: false,
      reportNumber: ''
    });
    onClose();
  };

  // === API Handlers ===

  const handleExportPdf = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Generating PDF report...');

    try {
      const response = await fetch('/api/vault/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          items: selectedItems,
          vaultName,
          options: pdfOptions
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${vaultName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`PDF exported with ${selectedItems.length} item(s)`, { id: toastId });
      resetAndClose();
    } catch (error) {
      toast.error('Failed to export PDF', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkSold = async () => {
    if (!saleDetails.salePrice) {
      toast.error('Please enter the sale price');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Recording sale...');

    try {
      const response = await fetch('/api/vault/items/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          itemIds: selectedItemIds,
          status: 'sold',
          details: saleDetails
        }),
      });

      if (!response.ok) throw new Error('Failed to update items');

      toast.success(`${selectedItems.length} item(s) marked as sold`, { id: toastId });
      onItemsUpdated();
      resetAndClose();
    } catch (error) {
      toast.error('Failed to mark items as sold', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkLostOrDamaged = async (status: 'lost' | 'damaged') => {
    if (!incidentDetails.description) {
      toast.error('Please describe what happened');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading(`Marking items as ${status}...`);

    try {
      const response = await fetch('/api/vault/items/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          itemIds: selectedItemIds,
          status,
          details: incidentDetails
        }),
      });

      if (!response.ok) throw new Error('Failed to update items');

      toast.success(`${selectedItems.length} item(s) marked as ${status}`, { id: toastId });
      onItemsUpdated();
      resetAndClose();
    } catch (error) {
      toast.error(`Failed to mark items as ${status}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    const toastId = toast.loading('Deleting items...');

    try {
      const response = await fetch('/api/vault/items/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ itemIds: selectedItemIds }),
      });

      if (!response.ok) throw new Error('Failed to delete items');

      toast.success(`${selectedItems.length} item(s) deleted`, { id: toastId });
      onSelectionChange([]);
      onItemsUpdated();
      resetAndClose();
    } catch (error) {
      toast.error('Failed to delete items', { id: toastId });
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  // === Render Screens ===

  const renderSelectionScreen = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Manage Vault Items
        </DialogTitle>
        <DialogDescription>
          Select items and choose an action. From vault: <span className="font-medium">{vaultName}</span>
        </DialogDescription>
      </DialogHeader>

      {/* Item Selection */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <span className="font-medium">{selectedItemIds.length}</span>
            <span className="text-muted-foreground"> of {items.length} selected</span>
            {totalValue > 0 && selectedItemIds.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-green-600">
                ${totalValue.toLocaleString()}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
            {selectedItemIds.length === items.length ? (
              <><CheckSquare className="h-4 w-4 mr-1" /> Deselect All</>
            ) : (
              <><Square className="h-4 w-4 mr-1" /> Select All</>
            )}
          </Button>
        </div>
        
        <ScrollArea className="h-[200px] p-2">
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedItemIds.includes(item.id)
                    ? 'bg-primary/10 border border-primary/50'
                    : 'hover:bg-muted/50 border border-transparent'
                }`}
              >
                <Checkbox checked={selectedItemIds.includes(item.id)} />
                {item.photos?.[0] ? (
                  <img src={item.photos[0]} alt="" className="w-10 h-10 object-cover rounded" />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{item.asset_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.valuation_data?.estimatedValue || 'No valuation'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 hover:bg-blue-500/10 hover:border-blue-500"
          onClick={() => setCurrentScreen('export-pdf')}
          disabled={selectedItemIds.length === 0}
        >
          <FileText className="h-6 w-6 text-blue-500" />
          <span>Export PDF</span>
        </Button>
        
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 hover:bg-green-500/10 hover:border-green-500"
          onClick={() => setCurrentScreen('mark-sold')}
          disabled={selectedItemIds.length === 0}
        >
          <DollarSign className="h-6 w-6 text-green-500" />
          <span>Mark Sold</span>
        </Button>
        
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 hover:bg-yellow-500/10 hover:border-yellow-500"
          onClick={() => setCurrentScreen('mark-lost')}
          disabled={selectedItemIds.length === 0}
        >
          <XCircle className="h-6 w-6 text-yellow-500" />
          <span>Mark Lost</span>
        </Button>
        
        <Button
          variant="outline"
          className="h-20 flex-col gap-1 hover:bg-orange-500/10 hover:border-orange-500"
          onClick={() => setCurrentScreen('mark-damaged')}
          disabled={selectedItemIds.length === 0}
        >
          <AlertOctagon className="h-6 w-6 text-orange-500" />
          <span>Mark Damaged</span>
        </Button>
      </div>

      {/* Delete at bottom */}
      <Button
        variant="ghost"
        className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
        onClick={() => setCurrentScreen('delete')}
        disabled={selectedItemIds.length === 0}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Selected Items
      </Button>
    </>
  );

  const renderPdfScreen = () => (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentScreen('select')}>
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

      <div className="space-y-4">
        {/* Format Selection */}
        <div className="space-y-2">
          <Label>Report Format</Label>
          <RadioGroup
            value={pdfOptions.format}
            onValueChange={(v) => setPdfOptions({ ...pdfOptions, format: v as any })}
            className="grid grid-cols-3 gap-2"
          >
            <div className={`border rounded-lg p-3 cursor-pointer ${pdfOptions.format === 'detailed' ? 'border-primary bg-primary/5' : ''}`}>
              <RadioGroupItem value="detailed" id="detailed" className="sr-only" />
              <Label htmlFor="detailed" className="cursor-pointer">
                <div className="font-medium">Detailed</div>
                <div className="text-xs text-muted-foreground">Full information</div>
              </Label>
            </div>
            <div className={`border rounded-lg p-3 cursor-pointer ${pdfOptions.format === 'summary' ? 'border-primary bg-primary/5' : ''}`}>
              <RadioGroupItem value="summary" id="summary" className="sr-only" />
              <Label htmlFor="summary" className="cursor-pointer">
                <div className="font-medium">Summary</div>
                <div className="text-xs text-muted-foreground">Quick overview</div>
              </Label>
            </div>
            <div className={`border rounded-lg p-3 cursor-pointer ${pdfOptions.format === 'insurance' ? 'border-primary bg-primary/5' : ''}`}>
              <RadioGroupItem value="insurance" id="insurance" className="sr-only" />
              <Label htmlFor="insurance" className="cursor-pointer">
                <div className="font-medium">Insurance</div>
                <div className="text-xs text-muted-foreground">Claims ready</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Include Options */}
        <div className="space-y-3">
          <Label>Include in Report</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'includePhotos', label: 'Photos', icon: ImageIcon },
              { key: 'includeValuations', label: 'Valuations', icon: DollarSign },
              { key: 'includeNotes', label: 'Notes & Serial #', icon: FileText },
              { key: 'includeProvenance', label: 'Provenance', icon: Shield },
            ].map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center space-x-2 border rounded-lg p-2">
                <Checkbox
                  id={key}
                  checked={pdfOptions[key as keyof typeof pdfOptions] as boolean}
                  onCheckedChange={(c) => setPdfOptions({ ...pdfOptions, [key]: !!c })}
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

      <Button onClick={handleExportPdf} disabled={isProcessing} className="w-full">
        {isProcessing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
        ) : (
          <><Download className="mr-2 h-4 w-4" /> Download PDF Report</>
        )}
      </Button>
    </>
  );

  const renderSoldScreen = () => (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentScreen('select')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-500" />
              Mark as Sold
            </DialogTitle>
            <DialogDescription>
              Record sale details for {selectedItems.length} item(s)
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="salePrice">Sale Price *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="salePrice"
                type="number"
                placeholder="0.00"
                className="pl-9"
                value={saleDetails.salePrice}
                onChange={(e) => setSaleDetails({ ...saleDetails, salePrice: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="saleDate">Sale Date</Label>
            <Input
              id="saleDate"
              type="date"
              value={saleDetails.saleDate}
              onChange={(e) => setSaleDetails({ ...saleDetails, saleDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="buyerInfo">Buyer</Label>
            <Input
              id="buyerInfo"
              placeholder="Name or username"
              value={saleDetails.buyerInfo}
              onChange={(e) => setSaleDetails({ ...saleDetails, buyerInfo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Input
              id="platform"
              placeholder="eBay, StockX, etc."
              value={saleDetails.platform}
              onChange={(e) => setSaleDetails({ ...saleDetails, platform: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="saleNotes">Notes</Label>
          <Textarea
            id="saleNotes"
            placeholder="Additional sale details..."
            value={saleDetails.notes}
            onChange={(e) => setSaleDetails({ ...saleDetails, notes: e.target.value })}
            rows={2}
          />
        </div>

        {totalValue > 0 && saleDetails.salePrice && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span>Original Value:</span>
              <span>${totalValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Sale Price:</span>
              <span>${parseFloat(saleDetails.salePrice || '0').toLocaleString()}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-medium">
              <span>Profit/Loss:</span>
              <span className={parseFloat(saleDetails.salePrice) >= totalValue ? 'text-green-500' : 'text-red-500'}>
                {parseFloat(saleDetails.salePrice) >= totalValue ? '+' : ''}
                ${(parseFloat(saleDetails.salePrice || '0') - totalValue).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <Button onClick={handleMarkSold} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700">
        {isProcessing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
        ) : (
          <><DollarSign className="mr-2 h-4 w-4" /> Confirm Sale</>
        )}
      </Button>
    </>
  );

  const renderLostDamagedScreen = (type: 'lost' | 'damaged') => {
    const isLost = type === 'lost';
    const Icon = isLost ? XCircle : AlertOctagon;
    const color = isLost ? 'yellow' : 'orange';

    return (
      <>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentScreen('select')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Icon className={`h-5 w-5 text-${color}-500`} />
                Mark as {isLost ? 'Lost' : 'Damaged'}
              </DialogTitle>
              <DialogDescription>
                Document {isLost ? 'loss' : 'damage'} for {selectedItems.length} item(s)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="incidentDate">Date</Label>
            <Input
              id="incidentDate"
              type="date"
              value={incidentDetails.date}
              onChange={(e) => setIncidentDetails({ ...incidentDetails, date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder={isLost ? "How/where was the item lost?" : "Describe the damage..."}
              value={incidentDetails.description}
              onChange={(e) => setIncidentDetails({ ...incidentDetails, description: e.target.value })}
              rows={3}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="insuranceClaim"
                checked={incidentDetails.insuranceClaim}
                onCheckedChange={(c) => setIncidentDetails({ ...incidentDetails, insuranceClaim: !!c })}
              />
              <Label htmlFor="insuranceClaim">Filing insurance claim</Label>
            </div>
            {incidentDetails.insuranceClaim && (
              <Input
                placeholder="Claim number"
                value={incidentDetails.claimNumber}
                onChange={(e) => setIncidentDetails({ ...incidentDetails, claimNumber: e.target.value })}
              />
            )}

            {isLost && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="policeReport"
                    checked={incidentDetails.policeReport}
                    onCheckedChange={(c) => setIncidentDetails({ ...incidentDetails, policeReport: !!c })}
                  />
                  <Label htmlFor="policeReport">Filed police report</Label>
                </div>
                {incidentDetails.policeReport && (
                  <Input
                    placeholder="Report number"
                    value={incidentDetails.reportNumber}
                    onChange={(e) => setIncidentDetails({ ...incidentDetails, reportNumber: e.target.value })}
                  />
                )}
              </>
            )}
          </div>

          {totalValue > 0 && (
            <div className={`bg-${color}-500/10 border border-${color}-500/30 rounded-lg p-3`}>
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className={`h-4 w-4 text-${color}-500`} />
                Value at risk: ${totalValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Consider exporting a PDF report first for insurance purposes.
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={() => handleMarkLostOrDamaged(type)}
          disabled={isProcessing}
          className={`w-full bg-${color}-600 hover:bg-${color}-700`}
        >
          {isProcessing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <><Icon className="mr-2 h-4 w-4" /> Confirm {isLost ? 'Lost' : 'Damaged'}</>
          )}
        </Button>
      </>
    );
  };

  const renderDeleteScreen = () => (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentScreen('select')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="h-5 w-5" />
              Delete Items
            </DialogTitle>
            <DialogDescription>
              Permanently remove {selectedItems.length} item(s) from your vault
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">This cannot be undone</p>
              <p className="text-sm text-muted-foreground">
                All photos, valuations, and documents will be permanently deleted.
                Consider marking items as "Sold" or "Lost" instead.
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[150px] border rounded-lg p-2">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-1 text-sm">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="truncate">{item.asset_name}</span>
              {item.valuation_data?.estimatedValue && (
                <span className="text-muted-foreground ml-auto">
                  {item.valuation_data.estimatedValue}
                </span>
              )}
            </div>
          ))}
        </ScrollArea>

        {totalValue > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Total value being deleted: <span className="text-red-500 font-medium">${totalValue.toLocaleString()}</span>
          </p>
        )}
      </div>

      <Button
        onClick={() => setShowDeleteConfirm(true)}
        disabled={isProcessing}
        variant="destructive"
        className="w-full"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete {selectedItems.length} Item(s) Permanently
      </Button>
    </>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={resetAndClose}>
        <DialogContent className="max-w-lg">
          {currentScreen === 'select' && renderSelectionScreen()}
          {currentScreen === 'export-pdf' && renderPdfScreen()}
          {currentScreen === 'mark-sold' && renderSoldScreen()}
          {currentScreen === 'mark-lost' && renderLostDamagedScreen('lost')}
          {currentScreen === 'mark-damaged' && renderLostDamagedScreen('damaged')}
          {currentScreen === 'delete' && renderDeleteScreen()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedItems.length} item(s) and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {isProcessing ? 'Deleting...' : 'Yes, Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default VaultExportModal;