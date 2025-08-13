export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    error: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export const themes: Record<string, { light: ThemeConfig; dark: ThemeConfig }> = {
  executive: {
    dark: {
      name: 'Executive (Dark)',
      colors: {
        primary: '#1a1a1a', // Deep polished black
        secondary: '#2a2a2a', // Brushed steel dark
        accent: '#004225', // Rolex green
        background: '#0a0a0a', // Deep black with sunburst
        surface: '#1f1f1f', // Dark metallic surface
        text: '#e0e0e0', // Light metallic text
        textSecondary: '#c0c0c0', // Silver text
        border: '#004225', // Rolex green borders
        success: '#004225',
        error: '#cc0000'
      },
      fonts: {
        heading: 'Playfair Display, serif', // Luxury watch serif
        body: 'Crimson Text, serif' // Elegant serif throughout
      }
    },
    light: {
      name: 'Executive (Light)',
      colors: {
        primary: '#f5f5f5', // Brushed steel
        secondary: '#e8e8e8', // Light brushed steel
        accent: '#004225', // Rolex green
        background: '#ffffff', // White dial
        surface: '#fafafa', // Light metallic surface
        text: '#1a1a1a', // Dark text
        textSecondary: '#666666', // Gray text
        border: '#004225', // Rolex green borders
        success: '#004225',
        error: '#cc0000'
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Crimson Text, serif'
      }
    }
  },
  matrix: {
    dark: {
      name: 'Matrix (Dark)',
      colors: {
        primary: '#00ff41', // Neon green
        secondary: '#0d1117', // Very dark background
        accent: '#00ff41',
        background: '#000000', // Pure black for digital rain
        surface: '#0d1117',
        text: '#00ff41', // Matrix green text
        textSecondary: '#00cc33',
        border: '#00ff41', // Glowing green borders
        success: '#00ff41',
        error: '#ff0040'
      },
      fonts: {
        heading: 'Courier New, monospace', // Terminal font
        body: 'Courier New, monospace'
      }
    },
    light: {
      name: 'Matrix (Light)',
      colors: {
        primary: '#00cc33',
        secondary: '#f0f0f0',
        accent: '#00cc33',
        background: '#ffffff',
        surface: '#f8f8f8',
        text: '#004d1a',
        textSecondary: '#006622',
        border: '#00cc33',
        success: '#00cc33',
        error: '#cc0033'
      },
      fonts: {
        heading: 'Courier New, monospace',
        body: 'Courier New, monospace'
      }
    }
  },
  safari: {
    dark: {
      name: 'Safari (Dark)',
      colors: {
        primary: '#8B4513', // Dark brown leather
        secondary: '#2F4F2F', // Dark olive green
        accent: '#CD853F', // Brushed brass
        background: '#1C1810', // Dark canvas texture
        surface: '#2A2419', // Aged paper dark
        text: '#F5F5DC', // Beige text
        textSecondary: '#D2B48C', // Tan
        border: '#8B4513', // Stitched leather borders
        success: '#556B2F',
        error: '#A0522D'
      },
      fonts: {
        heading: 'Playfair Display, serif', // Classic field guide serif
        body: 'Courier New, monospace' // Typewriter font
      }
    },
    light: {
      name: 'Safari (Light)',
      colors: {
        primary: '#8B4513', // Dark brown
        secondary: '#F5F5DC', // Beige
        accent: '#B8860B', // Dark goldenrod (brass)
        background: '#FAF0E6', // Canvas white texture
        surface: '#FFF8DC', // Cornsilk
        text: '#2F4F2F', // Dark olive green
        textSecondary: '#8B7355', // Dark khaki
        border: '#8B4513', // Leather brown
        success: '#6B8E23',
        error: '#A0522D'
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Courier New, monospace'
      }
    }
  },
  darkKnight: {
    dark: {
      name: 'Dark Knight (Dark)',
      colors: {
        primary: '#1a1a1a', // Obsidian black
        secondary: '#2d2d2d', // Deep charcoal
        accent: '#ffd700', // Sharp glowing yellow
        background: '#0a0a0a', // Deep black tactical
        surface: '#1f1f1f', // Dark brushed metal
        text: '#e0e0e0', // Light text
        textSecondary: '#b0b0b0', // Muted light
        border: '#ffd700', // Glowing yellow borders
        success: '#ffd700',
        error: '#ff4444'
      },
      fonts: {
        heading: 'Orbitron, monospace', // Angular military stencil
        body: 'Rajdhani, sans-serif' // Block tactical font
      }
    },
    light: {
      name: 'Dark Knight (Light)',
      colors: {
        primary: '#2d2d2d',
        secondary: '#f5f5f5',
        accent: '#cc9900', // Darker yellow for light mode
        background: '#ffffff',
        surface: '#f8f8f8',
        text: '#1a1a1a',
        textSecondary: '#666666',
        border: '#cc9900',
        success: '#cc9900',
        error: '#cc0000'
      },
      fonts: {
        heading: 'Orbitron, monospace',
        body: 'Rajdhani, sans-serif'
      }
    }
  },
  cyberpunk: {
    dark: {
      name: 'Cyberpunk Steampunk (Dark)',
      colors: {
        primary: '#ff0080', // Hot pink neon
        secondary: '#1a0033', // Deep purple
        accent: '#00ffff', // Cyan glow
        background: '#0a0015', // Very dark purple
        surface: '#1f0040', // Dark purple surface
        text: '#ff00ff', // Magenta text
        textSecondary: '#cc00cc', // Purple text
        border: '#00ffff', // Cyan borders
        success: '#00ff80',
        error: '#ff4080'
      },
      fonts: {
        heading: 'Orbitron, monospace', // Futuristic tech font
        body: 'Share Tech Mono, monospace' // Cyberpunk monospace
      }
    },
    light: {
      name: 'Cyberpunk Steampunk (Light)',
      colors: {
        primary: '#cc0066',
        secondary: '#f0f0ff',
        accent: '#0099cc',
        background: '#ffffff',
        surface: '#f8f8ff',
        text: '#330066',
        textSecondary: '#660099',
        border: '#0099cc',
        success: '#00cc66',
        error: '#cc0066'
      },
      fonts: {
        heading: 'Orbitron, monospace',
        body: 'Share Tech Mono, monospace'
      }
    }
  },
  ocean: {
    dark: {
      name: 'Ocean (Dark)',
      colors: {
        primary: '#1e3a8a', // Deep blue
        secondary: '#0f172a', // Dark slate
        accent: '#06b6d4', // Cyan
        background: '#020617', // Very dark blue
        surface: '#0f172a', // Dark surface
        text: '#e0f2fe', // Light blue text
        textSecondary: '#bae6fd', // Sky blue
        border: '#06b6d4', // Cyan borders
        success: '#10b981',
        error: '#ef4444'
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif'
      }
    },
    light: {
      name: 'Ocean (Light)',
      colors: {
        primary: '#1e40af',
        secondary: '#f1f5f9',
        accent: '#0891b2',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        textSecondary: '#475569',
        border: '#0891b2',
        success: '#059669',
        error: '#dc2626'
      },
      fonts: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif'
      }
    }
  },
  forest: {
    dark: {
      name: 'Forest (Dark)',
      colors: {
        primary: '#166534', // Forest green
        secondary: '#1c1917', // Dark brown
        accent: '#eab308', // Golden yellow
        background: '#0c0a09', // Very dark brown
        surface: '#1c1917', // Dark surface
        text: '#f7fee7', // Light green text
        textSecondary: '#d9f99d', // Lime green
        border: '#eab308', // Golden borders
        success: '#22c55e',
        error: '#dc2626'
      },
      fonts: {
        heading: 'Merriweather, serif',
        body: 'Source Sans Pro, sans-serif'
      }
    },
    light: {
      name: 'Forest (Light)',
      colors: {
        primary: '#15803d',
        secondary: '#f5f5f4',
        accent: '#ca8a04',
        background: '#ffffff',
        surface: '#fafaf9',
        text: '#1c1917',
        textSecondary: '#57534e',
        border: '#ca8a04',
        success: '#16a34a',
        error: '#dc2626'
      },
      fonts: {
        heading: 'Merriweather, serif',
        body: 'Source Sans Pro, sans-serif'
      }
    }
  },
  sunset: {
    dark: {
      name: 'Sunset (Dark)',
      colors: {
        primary: '#dc2626', // Red
        secondary: '#451a03', // Dark orange
        accent: '#f59e0b', // Amber
        background: '#1c0a00', // Very dark orange
        surface: '#451a03', // Dark surface
        text: '#fef3c7', // Light amber text
        textSecondary: '#fde68a', // Amber text
        border: '#f59e0b', // Amber borders
        success: '#10b981',
        error: '#ef4444'
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Lato, sans-serif'
      }
    },
    light: {
      name: 'Sunset (Light)',
      colors: {
        primary: '#dc2626',
        secondary: '#fef7ed',
        accent: '#d97706',
        background: '#ffffff',
        surface: '#fffbeb',
        text: '#1c1917',
        textSecondary: '#78716c',
        border: '#d97706',
        success: '#059669',
        error: '#dc2626'
      },
      fonts: {
        heading: 'Playfair Display, serif',
        body: 'Lato, sans-serif'
      }
    }
  }
};


export const getThemeConfig = (theme: string, mode: string): ThemeConfig => {
  return themes[theme]?.[mode as 'light' | 'dark'] || themes.safari.dark;
};