// FILE: src/components/scanner/components/GhostProtocolSheet.tsx
// Bottom sheet UI for Ghost Protocol configuration
// Captures location, store info, shelf price

import React from 'react';
import {
  X, Ghost, MapPin, Store, DollarSign, Clock,
  RefreshCw, Check, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { UseGhostModeReturn } from '../hooks/useGhostMode';

interface GhostProtocolSheetProps {
  isOpen: boolean;
  onClose: () => void;
  ghostMode: UseGhostModeReturn;
}

export const GhostProtocolSheet: React.FC<GhostProtocolSheetProps> = ({
  isOpen,
  onClose,
  ghostMode,
}) => {
  if (!isOpen) return null;

  const {
    isGhostMode,
    location,
    storeInfo,
    isCapturingLocation,
    locationError,
    handlingHours,
    isReady,
    toggleGhostMode,
    refreshLocation,
    updateStoreInfo,
    setHandlingHours,
  } = ghostMode;

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-semibold">Ghost Protocol</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <Ghost className={`h-6 w-6 ${isGhostMode ? 'text-purple-400 animate-pulse' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium">Ghost Mode</p>
                <p className="text-xs text-muted-foreground">List items you don't own yet</p>
              </div>
            </div>
            <Switch 
              checked={isGhostMode} 
              onCheckedChange={() => toggleGhostMode()} 
            />
          </div>

          {isGhostMode && (
            <>
              {/* Location Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location
                </Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  {isCapturingLocation ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span className="text-sm">Getting location...</span>
                    </>
                  ) : location ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400">
                        GPS locked (±{location.accuracy.toFixed(0)}m)
                      </span>
                      <Button variant="ghost" size="sm" onClick={refreshLocation} className="ml-auto">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </>
                  ) : locationError ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-red-400">{locationError}</span>
                      <Button variant="ghost" size="sm" onClick={refreshLocation} className="ml-auto">
                        Retry
                      </Button>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm">Location needed</span>
                      <Button variant="ghost" size="sm" onClick={refreshLocation} className="ml-auto">
                        Get Location
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Store Info */}
              <div className="space-y-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Store className="h-4 w-4" /> Store Details
                </Label>
                
                <Select 
                  value={storeInfo?.type || 'thrift'} 
                  onValueChange={(v) => updateStoreInfo({ type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Store type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thrift">Thrift Store</SelectItem>
                    <SelectItem value="antique">Antique Shop</SelectItem>
                    <SelectItem value="estate">Estate Sale</SelectItem>
                    <SelectItem value="garage">Garage/Yard Sale</SelectItem>
                    <SelectItem value="flea">Flea Market</SelectItem>
                    <SelectItem value="pawn">Pawn Shop</SelectItem>
                    <SelectItem value="auction">Auction</SelectItem>
                    <SelectItem value="retail">Retail Clearance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                
                <Input
                  placeholder="Store name (e.g. Goodwill on Main St)"
                  value={storeInfo?.name || ''}
                  onChange={(e) => updateStoreInfo({ name: e.target.value })}
                />
                
                <Input
                  placeholder="Aisle/Section (optional)"
                  value={storeInfo?.aisle || ''}
                  onChange={(e) => updateStoreInfo({ aisle: e.target.value })}
                />
              </div>

              {/* Shelf Price */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Shelf Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={storeInfo?.shelf_price || ''}
                    onChange={(e) => updateStoreInfo({ shelf_price: parseFloat(e.target.value) || 0 })}
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Handling Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Handling Time
                </Label>
                <Select 
                  value={handlingHours.toString()} 
                  onValueChange={(v) => setHandlingHours(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours (recommended)</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Time to retrieve and ship after sale
                </p>
              </div>

              {/* Ready Status */}
              <div className={`p-4 rounded-lg border ${
                isReady 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                {isReady ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Ready to ghost hunt!</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Missing info:</span>
                    </div>
                    <ul className="text-xs text-muted-foreground ml-7 list-disc">
                      {!location && <li>Location not captured</li>}
                      {(!storeInfo?.name || storeInfo.name.trim() === '') && <li>Store name required</li>}
                      {(!storeInfo?.shelf_price || storeInfo.shelf_price <= 0) && <li>Shelf price required</li>}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="w-full"
            variant={isReady ? 'default' : 'secondary'}
          >
            {isReady ? 'Start Hunting 👻' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GhostProtocolSheet;