// FILE: src/components/vault/VaultExportModal.tsx
// ═══════════════════════════════════════════════════════════════════════
// Vault Export Modal — Thin Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// Refactored from 900-line monolith following established pattern:
//   hooks/useVaultSelection.ts  — selection state + filtering
//   hooks/useVaultActions.ts    — all API calls
//   components/SelectionScreen  — item list + action buttons
//   components/ExportPdfScreen  — PDF options
//   components/MarkSoldScreen   — sale details
//   components/MarkIncidentScreen — lost/damaged (shared)
//   components/DeleteScreen     — delete confirmation
//
// SCROLL FIX (mobile):
//   DialogContent uses flex flex-col overflow-hidden with max-h-[90dvh].
//   dvh (dynamic viewport height) respects mobile browser chrome + keyboard.
//   Inner div owns the scroll — not the dialog itself.
//   Without this, content drops below the bottom of the screen on mobile.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
import { useVaultSelection, useVaultActions } from './hooks';
import {
  SelectionScreen,
  ExportPdfScreen,
  MarkSoldScreen,
  MarkIncidentScreen,
  DeleteScreen,
} from './components';
import type { VaultExportModalProps, ActionScreen } from './types';

const VaultExportModal: React.FC<VaultExportModalProps> = ({
  isOpen,
  onClose,
  items,
  vaultName,
  selectedItemIds,
  onSelectionChange,
  onItemsUpdated,
  session,
}) => {
  const [currentScreen, setCurrentScreen] = useState<ActionScreen>('select');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Selection state + filtering ───────────────────────
  const selection = useVaultSelection({ items, selectedItemIds, onSelectionChange });

  // ── API actions ───────────────────────────────────────
  const actions = useVaultActions({
    selectedItems: selection.selectedItems,
    selectedItemIds,
    vaultName,
    session,
    onSelectionChange,
    onItemsUpdated,
    onClose: () => {
      setCurrentScreen('select');
      onClose();
    },
  });

  const handleClose = () => {
    setCurrentScreen('select');
    selection.setSearchQuery('');
    actions.resetState();
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        {/* SCROLL FIX: flex flex-col + overflow-hidden on DialogContent,
            overflow-y-auto on inner div. dvh respects mobile browser chrome. */}
        <DialogContent className="max-w-lg w-[95vw] max-h-[90dvh] flex flex-col overflow-hidden p-0">
          <div className="overflow-y-auto flex-1 p-6 space-y-4">

            {currentScreen === 'select' && (
              <SelectionScreen
                items={items}
                vaultName={vaultName}
                filteredItems={selection.filteredItems}
                selectedItemIds={selectedItemIds}
                totalValue={selection.totalValue}
                searchQuery={selection.searchQuery}
                showInactiveItems={selection.showInactiveItems}
                inactiveCount={selection.inactiveCount}
                onSearchChange={selection.setSearchQuery}
                onShowInactiveChange={selection.setShowInactiveItems}
                onSelectAll={selection.selectAll}
                onSelectNone={selection.selectNone}
                onSelectActiveOnly={selection.selectActiveOnly}
                onToggleItem={selection.toggleItem}
                onNavigate={setCurrentScreen}
              />
            )}

            {currentScreen === 'export-pdf' && (
              <ExportPdfScreen
                selectedItems={selection.selectedItems}
                totalValue={selection.totalValue}
                pdfOptions={actions.pdfOptions}
                isProcessing={actions.isProcessing}
                onPdfOptionsChange={actions.setPdfOptions}
                onExport={actions.handleExportPdf}
                onBack={() => setCurrentScreen('select')}
              />
            )}

            {currentScreen === 'mark-sold' && (
              <MarkSoldScreen
                selectedItems={selection.selectedItems}
                totalValue={selection.totalValue}
                saleDetails={actions.saleDetails}
                isProcessing={actions.isProcessing}
                onSaleDetailsChange={actions.setSaleDetails}
                onConfirm={actions.handleMarkSold}
                onBack={() => setCurrentScreen('select')}
              />
            )}

            {(currentScreen === 'mark-lost' || currentScreen === 'mark-damaged') && (
              <MarkIncidentScreen
                type={currentScreen === 'mark-lost' ? 'lost' : 'damaged'}
                selectedItems={selection.selectedItems}
                totalValue={selection.totalValue}
                incidentDetails={actions.incidentDetails}
                isProcessing={actions.isProcessing}
                onIncidentDetailsChange={actions.setIncidentDetails}
                onConfirm={() => actions.handleMarkLostOrDamaged(
                  currentScreen === 'mark-lost' ? 'lost' : 'damaged'
                )}
                onBack={() => setCurrentScreen('select')}
              />
            )}

            {currentScreen === 'delete' && (
              <DeleteScreen
                selectedItems={selection.selectedItems}
                totalValue={selection.totalValue}
                isProcessing={actions.isProcessing}
                onConfirm={() => setShowDeleteConfirm(true)}
                onBack={() => setCurrentScreen('select')}
              />
            )}

          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation alert */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selection.selectedItems.length} item(s) and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {actions.isProcessing ? 'Deleting...' : 'Yes, Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default VaultExportModal;