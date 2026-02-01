// FILE: src/components/messaging/MessageActions.tsx

import { useState, useRef, useEffect } from 'react';
import { Trash2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface MessageActionsProps {
  messageId: string;
  senderId: string;
  isDeleted: boolean;
  onDelete: (messageId: string, forEveryone: boolean) => Promise<void>;
  onClose: () => void;
}

export function MessageActions({ 
  messageId, 
  senderId, 
  isDeleted,
  onDelete, 
  onClose 
}: MessageActionsProps) {
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isSender = user?.id === senderId;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDelete = async () => {
    if (isDeleted) return;
    
    setIsDeleting(true);
    try {
      await onDelete(messageId, deleteForEveryone && isSender);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDeleted) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200" />
      
      {/* Bottom Sheet */}
      <div 
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 
                   rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300
                   safe-area-bottom"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Message Options
          </h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-700 
                       dark:text-gray-400 dark:hover:text-gray-200
                       rounded-full hover:bg-gray-100 dark:hover:bg-gray-800
                       transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {!showConfirm ? (
            <>
              {/* Delete Button */}
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl
                           bg-red-50 dark:bg-red-900/20 
                           text-red-600 dark:text-red-400
                           hover:bg-red-100 dark:hover:bg-red-900/30
                           transition-colors active:scale-[0.98]"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-medium">Delete Message</span>
              </button>
            </>
          ) : (
            <>
              {/* Confirmation */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 
                              rounded-xl text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  {isSender 
                    ? "Choose how to delete this message"
                    : "This will remove the message from your view"
                  }
                </p>
              </div>

              {/* Delete options for sender */}
              {isSender && (
                <div className="space-y-2 py-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer
                                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={!deleteForEveryone}
                      onChange={() => setDeleteForEveryone(false)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Delete for me
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Others will still see this message
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer
                                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={deleteForEveryone}
                      onChange={() => setDeleteForEveryone(true)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Delete for everyone
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Message and attachments will be removed
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-medium
                             bg-gray-100 dark:bg-gray-800 
                             text-gray-700 dark:text-gray-300
                             hover:bg-gray-200 dark:hover:bg-gray-700
                             transition-colors active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-xl font-medium
                             bg-red-600 text-white
                             hover:bg-red-700 disabled:opacity-50
                             transition-colors active:scale-[0.98]
                             disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-6" />
      </div>
    </>
  );
}