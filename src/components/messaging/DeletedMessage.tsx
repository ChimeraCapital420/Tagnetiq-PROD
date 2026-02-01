// FILE: src/components/messaging/DeletedMessage.tsx

import { Ban } from 'lucide-react';

interface DeletedMessageProps {
  isSender: boolean;
  timestamp?: string;
}

export function DeletedMessage({ isSender, timestamp }: DeletedMessageProps) {
  return (
    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-2`}>
      <div 
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-2xl max-w-[80%]
          ${isSender 
            ? 'bg-gray-100 dark:bg-gray-800 rounded-br-md' 
            : 'bg-gray-100 dark:bg-gray-800 rounded-bl-md'
          }
        `}
      >
        <Ban className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-sm italic text-gray-500 dark:text-gray-400">
          {isSender ? 'You deleted this message' : 'This message was deleted'}
        </span>
      </div>
    </div>
  );
}