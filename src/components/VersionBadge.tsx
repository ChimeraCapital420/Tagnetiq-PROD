import React from 'react';
import { APP_VERSION } from '@/lib/constants'; // Assuming version is in a constants file

const VersionBadge: React.FC = () => {
  return (
    <div className="fixed top-4 left-4 z-50">
      <div className="px-3 py-1 bg-black/50 text-white text-xs font-semibold rounded-full backdrop-blur-sm border border-white/20">
        TagnetIQ — v{APP_VERSION} Beta
      </div>
    </div>
  );
};

export default VersionBadge;