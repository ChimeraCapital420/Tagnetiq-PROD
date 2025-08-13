// FILE: src/pages/admin/InvestorSuitePage.tsx (FINAL - REPLACE CONTENT)

import { useAppContext } from '@/contexts/AppContext'; // Corrected import
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Briefcase, DollarSign, Users } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { getThemeConfig } from '@/lib/themes'; // Import the theme config getter

// Mock data for charts
const revenueProjectionData = [
  { name: 'Q1', revenue: 50000 },
  { name: 'Q2', revenue: 250000 },
  { name: 'Q3', revenue: 750000 },
  { name: 'Q4', revenue: 1500000 },
  { name: 'Q5', revenue: 3000000 },
  { name: 'Q6', revenue: 5000000 },
];

const marketBreakdownData = [
  { name: 'Real Estate', value: 25.5 },
  { name: 'Vehicles', value: 10.2 },
  { name: 'Collectibles', value: 7.3 },
  { name: 'Luxury Goods & Art', value: 5.8 },
];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];


export const InvestorSuitePage = () => {
    const { theme, themeMode } = useAppContext();
    const themeConfig = getThemeConfig(theme, themeMode); // Get the theme config based on context

    return (
        <div 
            className="p-4 sm:p-6 md:p-8 min-h-screen animated-gradient"
            style={{
                background: `linear-gradient(-45deg, #0f172a, #1e3a8a, #4338ca, #111827)`,
            }}
        >
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 text-center">
                    <img src="/images/Modern Investor Presentation Design.jpg" alt="Investor Presentation" className="w-48 mx-auto mb-4 rounded-lg shadow-2xl" />
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: themeConfig.fonts.heading }}>
                        TagnetIQ Investor Suite
                    </h1>
                    <p className="text-lg text-gray-300">
                        Live Metrics & Projections for V9.0.2
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {/* TAM Card */}
                    <Card className="md:col-span-2 lg:col-span-1 bg-white/5 border-white/10 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center text-gray-300 text-sm font-normal"><Briefcase className="w-4 h-4 mr-2"/>Total Addressable Market</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="text-5xl font-bold text-cyan-300 sparkle-container">
                                $48.8B+
                                <div className="sparkle"></div><div className="sparkle"></div><div className="sparkle"></div><div className="sparkle"></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Initial focus on Real Estate & High-Value Collectibles.</p>
                        </CardContent>
                    </Card>
                     {/* Other Metric Cards */}
                    <Card className="bg-white/5 border-white/10 text-white">
                        <CardHeader><CardTitle className="flex items-center text-gray-300 text-sm font-normal"><DollarSign className="w-4 h-4 mr-2"/>Projected MRR (12 mo)</CardTitle></CardHeader>
                        <CardContent><p className="text-3xl font-bold">$1.2M</p></CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 text-white">
                        <CardHeader><CardTitle className="flex items-center text-gray-300 text-sm font-normal"><Users className="w-4 h-4 mr-2"/>Target User Growth</CardTitle></CardHeader>
                        <CardContent><p className="text-3xl font-bold">50,000</p></CardContent>
                    </Card>
                     <Card className="bg-white/5 border-white/10 text-white">
                        <CardHeader><CardTitle className="flex items-center text-gray-300 text-sm font-normal"><BarChart className="w-4 h-4 mr-2"/>Projected ROI (24 mo)</CardTitle></CardHeader>
                        <CardContent><p className="text-3xl font-bold">10x</p></CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue Projections */}
                    <Card className="lg:col-span-2 bg-white/5 border-white/10 text-white">
                        <CardHeader>
                            <CardTitle className="text-lg">Revenue Growth Projections (USD)</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] w-full p-0">
                           <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueProjectionData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                                    <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `$${(value as number / 1000000)}M`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#00C49F" fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Market Breakdown */}
                    <Card className="bg-white/5 border-white/10 text-white">
                        <CardHeader>
                            <CardTitle className="text-lg">Market Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] w-full p-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={marketBreakdownData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={(entry) => entry.name}>
                                        {marketBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Call to Action */}
                <div className="mt-8 text-center">
                    <a href="mailto:invest@tagnetiq.com?subject=Pitch Deck Request for TagnetIQ">
                        <button className="bg-cyan-400 text-black font-bold py-3 px-8 rounded-lg text-lg hover:bg-cyan-300 transition-transform hover:scale-105">
                            Request Pitch Deck & Investment Tiers
                        </button>
                    </a>
                </div>
            </div>
        </div>
    );
};