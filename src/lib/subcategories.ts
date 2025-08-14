// FILE: src/lib/subcategories.ts (REPLACE THE ENTIRE FILE WITH THIS)

export const subCategories: Record<string, { id: string; name: string; description: string }[]> = {
  'real-estate': [
    { id: 'real-estate-comps', name: 'Market Comps', description: 'Analyze comparable property sales.' },
    { id: 'real-estate-rental', name: 'Rental Analysis', description: 'Estimate potential rental income.' },
    { id: 'real-estate-flip', name: 'Flip Potential', description: 'Assess renovation and flip value.' },
  ],
  'vehicles': [
    { id: 'vehicles-vin', name: 'VIN Scan', description: 'Decode VIN for vehicle history.' },
    { id: 'vehicles-value', name: 'Market Value', description: 'Estimate current market value.' },
    { id: 'vehicles-auction', name: 'Auction Insights', description: 'Analyze recent auction prices.' },
  ],
  'lego': [
    { id: 'lego-set', name: 'Set Identification', description: 'Identify complete or partial sets.' },
    { id: 'lego-parts', name: 'Bulk Parts Value', description: 'Estimate value of bulk LEGO pieces.' },
    { id: 'lego-minifig', name: 'Minifigure Value', description: 'Value individual minifigures.' },
  ],
  'starwars': [
    { id: 'starwars-figures', name: 'Action Figures', description: 'Value vintage and modern figures.' },
    { id: 'starwars-vehicles', name: 'Vehicles & Playsets', description: 'Spaceships, vehicles, and sets.' },
    { id: 'starwars-props', name: 'Props & Ephemera', description: 'Replicas, posters, and signed items.' },
  ],
  'art': [
    { id: 'art-paintings', name: 'Paintings & Prints', description: 'Analyze artist signatures and styles.' },
    { id: 'art-sculptures', name: 'Sculptures & Decor', description: 'Identify materials and artist marks.' },
    { id: 'art-furniture', name: 'Furniture', description: 'Identify period and designer furniture.' },
  ],
  'books': [
    { id: 'books-firstedition', name: 'First Editions', description: 'Identify first edition markers.' },
    { id: 'books-comics', name: 'Comic Books', description: 'Analyze graded and raw comics.' },
    { id: 'books-magazines', name: 'Magazines & Ephemera', description: 'Value rare magazines and documents.' },
  ],
  'collectibles': [
    { id: 'collectibles-coins', name: 'Coins & Currency', description: 'Numismatic grading and valuation.' },
    { id: 'collectibles-stamps', name: 'Stamps', description: 'Philatelic identification and value.' },
    { id: 'collectibles-tradingcards', name: 'Trading Cards', description: 'Sports, TCG, and non-sport cards.' },
  ],
  'sports': [
    { id: 'sports-cards', name: 'Trading Cards', description: 'Grade and value sports cards.' },
    { id: 'sports-jerseys', name: 'Jerseys', description: 'Game-worn and autographed jerseys.' },
    { id: 'sports-autographs', name: 'Autographs', description: 'Authenticate and value signatures.' },
  ],
  // Amazon Arbitrage has no sub-categories and will behave as a direct-action button.
  'amazon': [],
};