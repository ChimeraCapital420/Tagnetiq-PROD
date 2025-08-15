// FILE: src/lib/constants.ts (This is the content for your new file)

import { Home, Zap, Gem, Car, Bot, Package } from 'lucide-react';

export const APP_VERSION = "V9.0.2 Beta";

export const CATEGORIES = [
    {
        id: 'real-estate',
        name: 'Real Estate',
        icon: Home,
        description: 'Analyze properties, find deals, and get market comps.',
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
        id: 'vehicles',
        name: 'Vehicles',
        icon: Car,
        description: 'Scan VINs, check vehicle history, and estimate market value.',
        status: 'Beta',
    },
    {
        id: 'luxury-goods',
        name: 'Luxury Goods',
        icon: Package,
        description: 'Authenticate and value watches, handbags, and fine art.',
        status: 'Beta',
    },
    {
        id: 'continuous-scan',
        name: 'Continuous Scanner',
        icon: Zap,
        description: 'Run the AI continuously to evaluate items in real-time.',
        status: 'Active',
    },
    {
        id: 'multi-image',
        name: 'Multi-Image Analyzer',
        icon: Bot,
        description: 'Upload and evaluate a batch of assets at once.',
        status: 'Beta',
    },
];