// FILE: src/components/investor/ProductDemos.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PlayCircle, Box, Building, BrainCircuit, Rocket } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// A placeholder for an embedded video player
const VideoPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center">
    <PlayCircle className="h-12 w-12 text-muted-foreground" />
    <p className="mt-2 text-sm text-muted-foreground">{title}</p>
    <p className="text-xs text-muted-foreground">(Video Coming Soon)</p>
  </div>
);

export const ProductDemos: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Demonstrations</CardTitle>
        <CardDescription>Interactive walkthroughs of TagnetIQ's core functionalities.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scanning" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scanning"><Box className="mr-2 h-4 w-4" />Core Scanning</TabsTrigger>
            <TabsTrigger value="real_estate"><Building className="mr-2 h-4 w-4" />Real Estate</TabsTrigger>
            <TabsTrigger value="ai_evals"><BrainCircuit className="mr-2 h-4 w-4" />AI Evaluations</TabsTrigger>
            <TabsTrigger value="sandbox"><Rocket className="mr-2 h-4 w-4" />Live Sandbox</TabsTrigger>
          </TabsList>

          <TabsContent value="scanning" className="pt-4">
            <h3 className="font-semibold mb-2">Primary Scanning Functionality</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A demonstration of the app's primary scanning functionality using both image recognition and barcode analysis to deliver instant asset intelligence.
            </p>
            <VideoPlaceholder title="Core Scanning Demo" />
          </TabsContent>

          <TabsContent value="real_estate" className="pt-4">
            <h3 className="font-semibold mb-2">Real Estate Module (ATTOM Data)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A preview of the powerful ATTOM Data integration for comprehensive real estate analysis, providing comps, valuations, and market trends.
            </p>
            <VideoPlaceholder title="Real Estate Module Demo" />
          </TabsContent>

          <TabsContent value="ai_evals" className="pt-4">
            <h3 className="font-semibold mb-2">AI Category Evaluations</h3>
            <p className="text-sm text-muted-foreground mb-4">
              An overview of the different AI evaluation models and how the Hydra Engine creates a consensus-based valuation across multiple categories.
            </p>
            <VideoPlaceholder title="AI Evaluations Overview" />
          </TabsContent>
          
          <TabsContent value="sandbox" className="pt-4">
             <div className="text-center p-8 border-dashed border-2 rounded-lg">
                <Rocket className="mx-auto h-12 w-12 text-primary" />
                <h3 className="font-semibold mt-4 mb-2">Explore the Live Application</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Launch a read-only "sandbox" version of the TagnetIQ dashboard. This pre-populated environment allows you to experience the full user interface and core features firsthand.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>Launch Sandbox Dashboard</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sandbox Mode Coming Soon</AlertDialogTitle>
                      <AlertDialogDescription>
                        This feature will provide a read-only, interactive demo of the main user dashboard. We're putting the finishing touches on it. Please check back later!
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogAction>Got it</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
             </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
};