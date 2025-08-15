// FILE: src/lib/constants.ts (VERIFIED)

import { Home, Zap, Gem, Car, Bot, Package, Star, Book, Trophy } from 'lucide-react';

export const APP_VERSION = "V9.0.2 Beta";

export const CATEGORIES = [
    {
        id: 'real-estate',
        name: 'Real Estate',
        icon: Home,
        description: 'Analyze properties and get market comps.',
    },
    {
        id: 'vehicles',
        name: 'Vehicles',
        icon: Car,
        description: 'Scan VINs and estimate market value.',
    },
    {
        id: 'collectibles',
        name: 'General Collectibles',
        icon: Gem,
        description: 'Value trading cards, coins, and stamps.',
    },
    {
        id: 'luxury-goods',
        name: 'Luxury Goods',
        icon: Package,
        description: 'Authenticate watches, handbags, and art.',
    },
    {
        id: 'lego',
        name: 'LEGO',
        icon: Bot,
        description: 'Identify sets, parts, and minifigures.',
    },
    {
        id: 'starwars',
        name: 'Star Wars',
        icon: Star,
        description: 'Value figures, vehicles, and props.',
    },
    {
        id: 'sports-memorabilia',
        name: 'Sports Memorabilia',
        icon: Trophy,
        description: 'Grade cards, jerseys, and autographs.',
    },
    {
        id: 'books-and-media',
        name: 'Books & Media',
        icon: Book,
        description: 'Value first editions, comics, and vinyl.',
    },
    {
        id: 'amazon',
        name: 'Amazon Arbitrage',
        icon: Zap,
        description: 'Direct barcode scan for FBA insights.',
    },
];