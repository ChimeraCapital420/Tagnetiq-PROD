import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

interface AnalysisHUDProps {
  isVisible: boolean;
  isLoading: boolean;
  error: string | null;
  code: string | null;
}

const AnalysisHUD: React.FC<AnalysisHUDProps> = ({ 
  isVisible, 
  isLoading, 
  error, 
  code 
}) => {
  const { setLastAnalysisResult } = useAppContext();

  // Update the main dashboard with the analysis result
  React.useEffect(() => {
    if (code && !isLoading && !error) {
      setLastAnalysisResult({
        decision: 'GO',
        item: `Item with Code: ${code}`,
        marketValue: '$150.00',
        code: code
      });
    }
  }, [code, isLoading, error, setLastAnalysisResult]);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-55">
      <div className="bg-black bg-opacity-90 text-white p-8 rounded-lg border-2 border-green-500 max-w-md backdrop-blur-sm">
        <div className="text-center space-y-4">
          {isLoading ? (
            <>
              <div className="text-2xl font-bold text-yellow-400 font-mono">
                ANALYZING...
              </div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto"></div>
            </>
          ) : error ? (
            <div className="text-xl font-bold text-red-400 font-mono">
              {error}
            </div>
          ) : code ? (
            <>
              <div className="text-4xl font-bold text-green-400 font-mono">
                GO
              </div>
              <div className="text-lg font-mono">
                Item with Code: {code}
              </div>
              <div className="text-xl font-semibold text-green-300 font-mono">
                Est. Market Value: $150.00
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AnalysisHUD;