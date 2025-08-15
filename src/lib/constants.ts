// FILE: src/lib/constants.ts

import { Home, Zap, Gem, Car, Bot, Package, Star, Book, Palette } from 'lucide-react';

export const APP_VERSION = "V9.0.2 Beta";

// CORRECTED: Restored all 9 categories to ensure they appear on the dashboard.
export const CATEGORIES = [
    {
        id: 'real-estate',
        name: 'Real Estate',
        icon: Home,
        description: 'Analyze properties, find deals, and get market comps.',
        status: 'Active',
    },
    {
        id: 'vehicles',
        name: 'Vehicles',
        icon: Car,
        description: 'Scan VINs, check vehicle history, and estimate market value.',
        status: 'Beta',
    },
    {
        id: 'lego',
        name: 'Lego',
        icon: Gem,
        description: 'Identify sets, parts, and minifigures.',
        status: 'Active',
    },
    {
        id: 'starwars',
        name: 'Star Wars',
        icon: Star,
        description: 'Value figures, vehicles, and collectibles.',
        status: 'Active',
    },
    {
        id: 'art',
        name: 'Art & Furniture',
        icon: Palette,
        description: 'Analyze paintings, sculptures, and furniture.',
        status: 'Active',
    },
    {
        id: 'books',
        name: 'Books & Comics',
        icon: Book,
        description: 'Identify first editions and graded comics.',
        status: 'Active',
    },
    {
        id: 'collectibles',
        name: 'Collectibles',
        icon: Gem,
        description: 'Value trading cards, coins, stamps, and other rare items.',
        status: 'Active',
    },
    {
        id: 'sports',
        name: 'Sports Memorabilia',
        icon: Zap,
        description: 'Grade cards, jerseys, and autographs.',
        status: 'Active',
    },
    {
        id: 'amazon',
        name: 'Amazon Arbitrage',
        icon: Package,
        description: 'Scan barcodes for direct Amazon resale analysis.',
        status: 'Active',
    },
];