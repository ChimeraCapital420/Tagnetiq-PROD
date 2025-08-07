import React from 'react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { useNavigate } from 'react-router-dom';
const Hero: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  const navigate = useNavigate();

  const getHeroStyles = () => {
    const baseStyle = {
      backgroundColor: 'transparent', // Make background transparent for all themes
      color: themeConfig.colors.text,
      fontFamily: themeConfig.fonts.body
    };

    return baseStyle;
  };

  return (
    <section 
      className="relative h-screen w-screen flex items-center justify-center overflow-hidden fixed inset-0" 
      style={{
        ...getHeroStyles(),
        backgroundImage: 'url(https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754366160491_08b595d9.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Theme-specific overlay elements */}
      <div className="absolute inset-0 opacity-20">
        <div className={`absolute top-20 left-10 w-32 h-32 border-2 rounded-lg animate-pulse`} 
             style={{ borderColor: themeConfig.colors.accent }} />
        <div className={`absolute top-40 right-20 w-24 h-24 border-2 rounded-full animate-bounce`}
             style={{ borderColor: themeConfig.colors.primary }} />
        <div className={`absolute bottom-32 left-20 w-20 h-20 border-2 rotate-45 animate-spin`}
             style={{ borderColor: themeConfig.colors.accent }} />
      </div>
      {/* Digital Grid Background - theme aware */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className="border" style={{ borderColor: `${themeConfig.colors.border}30` }} />
          ))}
        </div>
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4" style={{ marginTop: '-80mm' }}>
        {/* Main Logo */}
        <div className="mb-8">
          <img 
            src="https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png"
            alt="The Resale OS Logo"
            className="mx-auto max-w-md w-full h-auto animate-pulse"
            style={{
              filter: theme === 'matrix' 
                ? 'hue-rotate(120deg) saturate(1.5)'
                : theme === 'executive'
                ? 'brightness(1.2) contrast(1.1)'
                : 'none'
            }}
          />
        </div>





        {/* Sign Up Button */}
        <div className="mt-6" style={{ marginTop: '40mm' }}>
          <Button
            onClick={() => navigate('/signup')}
            variant="outline"
            size="lg"
            className="font-semibold text-lg px-8 py-4 rounded-xl border-2 hover:scale-105 transition-all duration-300"
            style={{
              borderColor: '#ff6b35',
              color: '#ff6b35',
              backgroundColor: 'transparent',
              fontFamily: themeConfig.fonts.heading
            }}
          >
            Sign Up for Free
          </Button>
        </div>

        {/* Removed "Legolas AI Ready" status indicator */}
      </div>
      

    </section>
  );
};
export default Hero;