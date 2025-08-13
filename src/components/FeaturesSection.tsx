import React from 'react';
import { Eye, Zap, Target } from 'lucide-react';

const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: Eye,
      title: "AI Vision",
      description: "Instantly identify high-value items."
    },
    {
      icon: Zap,
      title: "Instant Analysis", 
      description: "Get real-time market data and profit estimates."
    },
    {
      icon: Target,
      title: "Profit Targeting",
      description: "Discover the hidden gems others miss."
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-black/80 to-gray-900/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-6">
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-300 font-sans text-lg">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;