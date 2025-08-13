import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { User } from 'lucide-react';

interface ScreenNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (screenName: string) => void;
  currentScreenName?: string;
}

const ScreenNameModal: React.FC<ScreenNameModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentScreenName = ''
}) => {
  const { theme, themeMode } = useAppContext();
  const [screenName, setScreenName] = useState(currentScreenName);
  const themeConfig = getThemeConfig(theme, themeMode);

  const handleSave = () => {
    if (screenName.trim()) {
      onSave(screenName.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="backdrop-blur-sm border max-w-md"
        style={{
          backgroundColor: `${themeConfig.colors.surface}95`,
          borderColor: `${themeConfig.colors.border}50`,
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="flex items-center"
            style={{ 
              color: themeConfig.colors.text,
              fontFamily: themeConfig.fonts.heading
            }}
          >
            <User className="w-5 h-5 mr-2" />
            Choose Screen Name
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label 
              htmlFor="screenName"
              style={{ color: themeConfig.colors.text }}
            >
              Screen Name
            </Label>
            <Input
              id="screenName"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder="Enter your screen name"
              className="backdrop-blur-sm"
              style={{
                backgroundColor: `${themeConfig.colors.surface}50`,
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
              maxLength={20}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              style={{
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!screenName.trim()}
              style={{
                backgroundColor: themeConfig.colors.primary,
                color: 'white'
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScreenNameModal;