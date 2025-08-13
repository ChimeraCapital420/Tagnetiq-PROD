// FILE: src/pages/analyze/MultiImageAnalyzerPage.tsx (REPLACE THIS FILE'S CONTENT)

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAppContext } from '@/contexts/AppContext'; // Corrected import
import { UploadCloud, Bot } from 'lucide-react';
import { ImagePreviewCard } from '@/components/ImagePreviewCard'; // Corrected import
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export const MultiImageAnalyzerPage: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.filter(
      (newFile) => !files.some((existingFile) => existingFile.name === newFile.name)
    );
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] },
  });

  const toggleFileSelection = (fileName: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const handleGroupedAnalysis = () => {
      console.log('Analyzing selected files as a single item:', Array.from(selectedFiles));
      toast({
          title: "Grouped Analysis Started",
          description: `Analyzing ${selectedFiles.size} images as one item.`
      });
      setSelectedFiles(new Set());
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center">
            <Bot className="w-8 h-8 mr-3 text-purple-400" />
            Multi-Image AI Analyzer
          </h1>
          <p className="text-gray-400">
            Upload multiple asset images for simultaneous evaluation and AI training.
          </p>
        </div>

        <div
          {...getRootProps()}
          className={`p-12 text-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-purple-400'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          {isDragActive ? (
            <p className="text-purple-400">Drop the files here...</p>
          ) : (
            <p className="text-gray-400">Drag & drop images here, or click to select files</p>
          )}
        </div>

        {files.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Analysis Queue ({files.length})</h2>
                {selectedFiles.size > 1 && (
                    <Button onClick={handleGroupedAnalysis}>
                        Analyze {selectedFiles.size} as One Item
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file, index) => (
                <ImagePreviewCard 
                    key={`${file.name}-${index}`} 
                    file={file} 
                    isSelected={selectedFiles.has(file.name)}
                    onToggleSelect={() => toggleFileSelection(file.name)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};