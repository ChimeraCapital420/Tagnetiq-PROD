// FILE: src/lib/subcategories.ts (VERIFIED)

export const subCategories: Record<string, { id: string; name: string; description: string; comingSoon?: boolean }[]> = {
  'real-estate': [
    { id: 'real-estate-comps', name: 'Market Comps', description: 'Analyze comparable property sales.' },
    { id: 'real-estate-rental', name: 'Rental Analysis', description: 'Estimate potential rental income.', comingSoon: true },
    { id: 'real-estate-flip', name: 'Flip Potential', description: 'Assess renovation and flip value.', comingSoon: true },
  ],
  'vehicles': [
    { id: 'vehicles-vin', name: 'VIN Scan', description: 'Decode VIN for vehicle history.' },
    { id: 'vehicles-value', name: 'Market Value', description: 'Estimate current market value.' },
    { id: 'vehicles-auction', name: 'Auction Insights', description: 'Analyze recent auction prices.' },
    { id: 'vehicles-parts', name: 'Parts Valuation', description: 'Identify and value individual parts.', comingSoon: true },
  ],
  'collectibles': [
    { id: 'collectibles-coins', name: 'Coins & Currency', description: 'Numismatic grading and valuation.' },
    { id: 'collectibles-stamps', name: 'Stamps', description: 'Philatelic identification and value.' },
    { id: 'collectibles-tradingcards', name: 'Trading Cards', description: 'Sports, TCG, and non-sport cards.' },
    { id: 'collectibles-comics', name: 'Comic Books', description: 'Analyze graded and raw comics.' },
    { id: 'collectibles-toys', name: 'Vintage Toys', description: 'Value classic and rare toys.' },
  ],
  'luxury-goods': [
      { id: 'luxury-watches', name: 'Watches', description: 'Authenticate and value luxury timepieces.' },
      { id: 'luxury-handbags', name: 'Handbags', description: 'Value designer and couture handbags.' },
      { id: 'luxury-jewelry', name: 'Jewelry', description: 'Analyze gemstones and precious metals.' },
      { id: 'luxury-art', name: 'Fine Art', description: 'Value paintings, sculptures, and prints.' },
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
  'sports-memorabilia': [
    { id: 'sports-cards', name: 'Trading Cards', description: 'Grade and value sports cards.' },
    { id: 'sports-jerseys', name: 'Jerseys', description: 'Game-worn and autographed jerseys.' },
    { id: 'sports-autographs', name: 'Autographs', description: 'Authenticate and value signatures.' },
  ],
  'books-and-media': [
    { id: 'books-firstedition', name: 'First Editions', description: 'Identify first edition markers.' },
    { id: 'books-vinyl', name: 'Vinyl Records', description: 'Grade and value rare records.', comingSoon: true },
    { id: 'books-videogames', name: 'Video Games', description: 'Value retro and sealed video games.', comingSoon: true },
  ],
  'amazon': [], // This correctly has no subcategories
};