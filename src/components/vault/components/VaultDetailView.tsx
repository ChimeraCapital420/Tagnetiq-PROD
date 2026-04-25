// FILE: src/components/vault/components/VaultDetailView.tsx
// Individual vault items grid view.
// Add per-item actions HERE without touching the lobby or orchestrator.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VaultItemCard } from '@/components/vault/VaultItemCard';
import { PdfDownloadButton } from '@/components/vault/PdfDownloadButton';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import ChallengeConfirmationModal from '@/components/arena/ChallengeConfirmationModal';
import { VaultSecurityControls } from './VaultSecurityControls';
import { VaultSkeletonLoader } from './VaultSkeletonLoader';
import type { VaultType, VaultItem, SecurityLevel } from '../types';

interface VaultDetailViewProps {
  vault: VaultType;
  items: VaultItem[] | undefined;
  isLoading: boolean;
  // Security
  securityLevel: SecurityLevel;
  isTrustedDevice: boolean;
  trustedUntil: Date | null | undefined;
  mfaEnrolled: boolean;
  onOpenSecuritySettings: () => void;
  onLock: () => void;
  onForgetDevice: () => void;
  onLockAndForget: () => void;
  // Item actions
  onUpdateItem: (item: VaultItem) => void;
  onBack: () => void;
  // Challenge
  onChallenge: (item: VaultItem, purchasePrice: number, askingPrice: number) => Promise<void>;
}

export const VaultDetailView: React.FC<VaultDetailViewProps> = ({
  vault, items, isLoading,
  securityLevel, isTrustedDevice, trustedUntil, mfaEnrolled,
  onOpenSecuritySettings, onLock, onForgetDevice, onLockAndForget,
  onUpdateItem, onBack, onChallenge,
}) => {
  const [selectedItem, setSelectedItem] = React.useState<VaultItem | null>(null);
  const [itemToChallenge, setItemToChallenge] = React.useState<VaultItem | null>(null);

  return (
    <>
      <motion.div
        className="container mx-auto p-4 md:p-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 md:mb-8">
          <div className="flex items-start gap-2 md:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="touch-manipulation shrink-0">
              <ChevronLeft className="h-5 md:h-6 w-5 md:w-6" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <h1 className="text-2xl md:text-4xl font-bold tracking-wider line-clamp-1">{vault.name}</h1>
                <Badge variant="outline" className="text-green-400 border-green-400/50 bg-green-400/10">
                  <ShieldCheck className="h-3 w-3 mr-1" />Secured
                </Badge>
              </div>
              {vault.description && (
                <p className="text-gray-400 mt-1 text-sm md:text-base line-clamp-2">{vault.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 ml-8 sm:ml-0">
            <VaultSecurityControls
              securityLevel={securityLevel}
              isTrustedDevice={isTrustedDevice}
              trustedUntil={trustedUntil}
              mfaEnrolled={mfaEnrolled}
              onOpenSecuritySettings={onOpenSecuritySettings}
              onLock={onLock}
              onForgetDevice={onForgetDevice}
              onLockAndForget={onLockAndForget}
            />
            {items && items.length > 0 && <PdfDownloadButton items={items} />}
          </div>
        </div>

        {isLoading && <VaultSkeletonLoader />}

        {!isLoading && items && items.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
          >
            {items.map(item => (
              <VaultItemCard
                key={item.id}
                item={item}
                onSelect={() => setSelectedItem(item)}
                onStartChallenge={() => setItemToChallenge(item)}
              />
            ))}
          </motion.div>
        )}

        {!isLoading && (!items || items.length === 0) && (
          <div className="text-center py-12 md:py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-xl md:text-2xl font-semibold">This Vault is Empty</h2>
            <p className="text-muted-foreground mt-2 text-sm md:text-base px-4">
              Add items from the analysis page to secure them in this vault.
            </p>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedItem && (
          <ItemDetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdate={item => { onUpdateItem(item); setSelectedItem(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemToChallenge && (
          <ChallengeConfirmationModal
            isOpen={!!itemToChallenge}
            onClose={() => setItemToChallenge(null)}
            item={itemToChallenge}
            onConfirm={async (purchase, asking) => {
              await onChallenge(itemToChallenge, purchase, asking);
              setItemToChallenge(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};