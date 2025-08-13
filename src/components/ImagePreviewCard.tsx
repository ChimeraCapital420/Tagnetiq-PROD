// FILE: src/components/ImagePreviewCard.tsx (CREATE THIS NEW FILE)

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Loader2, CheckCircle, ThumbsUp, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ImagePreviewCardProps {
  file: File;
  isSelected: boolean;
  onToggleSelect: () => void;
}

type AnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'error';
type Feedback = 'none' | 'good';

export const ImagePreviewCard: React.FC<ImagePreviewCardProps> = ({ file, isSelected, onToggleSelect }) => {
  const { theme, themeMode } = useAppContext();
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('pending');
  const [result, setResult] = useState<{ name: string; value: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>('none');

  useEffect(() => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    const analysisTimer = setTimeout(() => {
        setStatus('analyzing');
        const completeTimer = setTimeout(() => {
            if (Math.random() > 0.2) {
                setStatus('complete');
                setResult({ name: 'Vintage Action Figure', value: '$75.00' });
            } else {
                setStatus('error');
            }
        }, 2000 + Math.random() * 2000);

        return () => clearTimeout(completeTimer);
    }, 500);

    return () => {
        clearTimeout(analysisTimer);
    };
  }, [file]);

  const handleFeedback = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the card's onToggleSelect from firing
      setFeedback('good');
      toast({
          title: "Feedback Received!",
          description: "Thanks for helping train our AI."
      });
  }

  const renderStatus = () => {
    // ... renderStatus logic here
  }

  return (
    <div 
        className={`relative border-2 rounded-lg overflow-hidden cursor-pointer ${isSelected ? 'border-purple-500' : 'border-transparent'}`}
        onClick={onToggleSelect}
    >
        <div className="absolute top-2 right-2 z-10 h-5 w-5 rounded-sm flex items-center justify-center" style={{backgroundColor: isSelected ? '#8b5cf6' : 'rgba(255,255,255,0.3)'}}>
            {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
        </div>
        <div className="w-full h-40 bg-cover bg-center" style={{ backgroundImage: `url(${preview})` }} />
        {/* ... rest of card content */}
    </div>
  );
};