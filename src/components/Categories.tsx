import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';
import { Car, Blocks, Zap, Gamepad2, Camera, Watch, Shirt, Home } from 'lucide-react';

const Categories: React.FC = () => {
  const { selectedCategory, setSelectedCategory } = useAppContext();

  const categories = [
    { name: 'Vehicles', icon: Car, color: 'from-blue-500 to-cyan-400' },
    { name: 'LEGO Sets', icon: Blocks, color: 'from-red-500 to-orange-400' },
    { name: 'Star Wars', icon: Zap, color: 'from-yellow-500 to-amber-400' },
    { name: 'Gaming', icon: Gamepad2, color: 'from-purple-500 to-pink-400' },
    { name: 'Electronics', icon: Camera, color: 'from-green-500 to-emerald-400' },
    { name: 'Watches', icon: Watch, color: 'from-indigo-500 to-blue-400' },
    { name: 'Fashion', icon: Shirt, color: 'from-pink-500 to-rose-400' },
    { name: 'Home & Garden', icon: Home, color: 'from-teal-500 to-cyan-400' },
  ];

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    toast({
      title: `${categoryName} Selected`,
      description: `Legolas AI is now primed for ${categoryName} analysis.`,
    });
  };

  return (
    <section className="py-16" style={{ backgroundColor: 'transparent' }}>
      <div className="max-w-6xl mx-auto px-4">
        <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-white">
              Trainable AI Categories
            </CardTitle>
            <p className="text-center text-gray-300 mt-2">
              Select a category to prime Legolas AI for specialized analysis
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category) => {
                const IconComponent = category.icon;
                const isSelected = selectedCategory === category.name;
                
                return (
                  <Button
                    key={category.name}
                    onClick={() => handleCategorySelect(category.name)}
                    variant={isSelected ? "default" : "outline"}
                    className={`
                      h-24 flex flex-col items-center justify-center space-y-2 
                      ${isSelected 
                        ? `bg-gradient-to-r ${category.color} text-white shadow-lg` 
                        : 'border-purple-500/30 text-purple-300 hover:bg-purple-500/10'
                      }
                      transition-all duration-300 transform hover:scale-105
                    `}
                  >
                    <IconComponent className="w-6 h-6" />
                    <span className="text-xs font-medium">{category.name}</span>
                  </Button>
                );
              })}
            </div>
            
            {selectedCategory && (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center px-4 py-2 bg-green-500/20 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2" />
                  <span className="text-green-400 text-sm">
                    AI primed for {selectedCategory} analysis
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Categories;