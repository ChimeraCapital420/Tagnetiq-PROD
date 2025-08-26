// FILE: src/components/LanguageSelector.tsx (REVISED AND CORRECTED)

import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const changeLanguage = async (lng: string, langName: string) => {
    i18n.changeLanguage(lng);
    toast.success(`Language set to ${langName}.`);
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ language_preference: lng })
        .eq('id', user.id);
      if (error) {
        toast.error('Could not save language preference.');
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => changeLanguage('en', 'English')} variant={i18n.language === 'en' ? 'default' : 'outline'}>
        English
      </Button>
      <Button onClick={() => changeLanguage('es', 'Español')} variant={i18n.language === 'es' ? 'default' : 'outline'}>
        Español
      </Button>
      <Button onClick={() => changeLanguage('fr', 'Français')} variant={i18n.language === 'fr' ? 'default' : 'outline'}>
        Français
      </Button>
      <Button onClick={() => changeLanguage('it', 'Italiano')} variant={i18n.language === 'it' ? 'default' : 'outline'}>
        Italiano
      </Button>
    </div>
  );
};
