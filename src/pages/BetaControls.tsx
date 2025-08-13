// FILE: src/pages/admin/BetaControlsPage.tsx (FINAL - REPLACE CONTENT)

import { useAppContext } from '@/contexts/AppContext'; // Corrected import
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, BarChart2, Server, Users, Cpu, ToggleRight } from 'lucide-react';
import { getThemeConfig } from '@/lib/themes'; // Import the theme config getter

export const BetaControlsPage = () => {
    const { theme, themeMode } = useAppContext();
    const themeConfig = getThemeConfig(theme, themeMode); // Get the theme config based on context
    const { flags, setFlag } = useFeatureFlags();

    const featureFlags = [
        { id: 'isAttomApiEnabled', label: 'Real Estate (ATTOM API)', description: 'Enables live property data lookups.' },
        { id: 'isMultiImageAnalysisEnabled', label: 'Multi-Image Analyzer', description: 'Allows uploading multiple assets at once.' },
        { id: 'isSeasonalBrandingActive', label: 'Seasonal Branding', description: 'Activates holiday and seasonal themes.' },
        { id: 'isInvestorSuitePublic', label: 'Public Investor Suite', description: 'Makes the investor suite visible to non-admins.' },
    ];

    const analyticsData = [
        { label: 'Active Users', value: '42', icon: Users },
        { label: 'Scans Today', value: '1,283', icon: Cpu },
        { label: 'API Calls (24h)', value: '24,591', icon: Server },
    ];

    const systemStatus = [
        { name: 'Backend Services', status: 'Operational' },
        { name: 'Supabase Auth', status: 'Operational' },
        { name: 'ATTOM Real Estate API', status: 'Operational' },
        { name: 'Multi-Category AI', status: 'Degraded Performance' },
    ];

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center" style={{ fontFamily: themeConfig.fonts.heading, color: themeConfig.colors.text }}>
                        <ShieldCheck className="w-8 h-8 mr-3" style={{ color: themeConfig.colors.primary }}/>
                        Beta Control Center
                    </h1>
                    <p style={{ color: themeConfig.colors.textSecondary }}>
                        Manage live features and monitor application health.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Feature Flags */}
                    <Card className="lg:col-span-2 backdrop-blur-sm" style={{ backgroundColor: `${themeConfig.colors.surface}99`, borderColor: themeConfig.colors.border }}>
                        <CardHeader>
                            <CardTitle className="flex items-center"><ToggleRight className="mr-2"/>Feature Flags</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {featureFlags.map(feature => (
                                <div key={feature.id} className="flex items-center justify-between p-3 rounded-lg" style={{backgroundColor: `${themeConfig.colors.background}80`}}>
                                    <div>
                                        <h3 className="font-medium" style={{ color: themeConfig.colors.text }}>{feature.label}</h3>
                                        <p className="text-sm" style={{ color: themeConfig.colors.textSecondary }}>{feature.description}</p>
                                    </div>
                                    <Switch
                                        checked={flags[feature.id as keyof typeof flags]}
                                        onCheckedChange={(checked) => setFlag(feature.id as keyof typeof flags, checked)}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Side Panel */}
                    <div className="space-y-6">
                        {/* Usage Analytics */}
                        <Card className="backdrop-blur-sm" style={{ backgroundColor: `${themeConfig.colors.surface}99`, borderColor: themeConfig.colors.border }}>
                            <CardHeader>
                                <CardTitle className="flex items-center"><BarChart2 className="mr-2"/>Live Analytics</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {analyticsData.map(item => {
                                    const Icon = item.icon;
                                    return (
                                    <div key={item.label} className="flex justify-between items-center">
                                        <div className="flex items-center text-sm" style={{ color: themeConfig.colors.textSecondary }}>
                                            <Icon className="w-4 h-4 mr-2" />
                                            {item.label}
                                        </div>
                                        <span className="font-semibold text-lg" style={{ color: themeConfig.colors.text }}>{item.value}</span>
                                    </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* System Status */}
                        <Card className="backdrop-blur-sm" style={{ backgroundColor: `${themeConfig.colors.surface}99`, borderColor: themeConfig.colors.border }}>
                            <CardHeader>
                                <CardTitle className="flex items-center"><Server className="mr-2"/>System Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {systemStatus.map(system => (
                                    <div key={system.name} className="flex justify-between items-center text-sm">
                                        <span style={{ color: themeConfig.colors.textSecondary }}>{system.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${system.status === 'Operational' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                            <span style={{ color: system.status === 'Operational' ? themeConfig.colors.success : themeConfig.colors.accent }}>
                                                {system.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};