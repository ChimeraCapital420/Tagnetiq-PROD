import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const FinalCTASection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section className="py-24 bg-gradient-to-b from-gray-900/80 to-black relative">
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-8">
          Ready to Transform Your Resale Game?
        </h2>
        
        <p className="text-xl text-gray-300 mb-12 font-sans">
          Join thousands of resellers who are already using AI to maximize their profits.
        </p>
        
        <Button 
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-6 text-xl font-semibold rounded-lg shadow-2xl"
          onClick={() => navigate('/signup')}
        >
          Sign Up for Free
        </Button>
      </div>
    </section>
  );
};

export default FinalCTASection;