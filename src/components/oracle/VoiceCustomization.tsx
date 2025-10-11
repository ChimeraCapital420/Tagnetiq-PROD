// src/components/oracle/VoiceCustomization.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Volume2, Mic, Globe, Sparkles, DollarSign, 
  Play, Pause, Upload, Bot, User 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useVoiceManager } from '../../hooks/useVoiceManager';
import { toast } from 'sonner';

export default function VoiceCustomization() {
  const { 
    voiceManager, 
    currentVoice, 
    setCurrentVoice,
    availableVoices,
    testVoice,
    cloneVoice,
    isProcessing 
  } = useVoiceManager();

  const [selectedProvider, setSelectedProvider] = useState('elevenlabs');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [voiceSettings, setVoiceSettings] = useState({
    speed: 1.0,
    pitch: 0,
    stability: 0.5,
    emotion: 'neutral'
  });

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' }
  ];

  const emotions = [
    { id: 'neutral', name: 'Neutral', icon: '😐' },
    { id: 'happy', name: 'Happy', icon: '😊' },
    { id: 'excited', name: 'Excited', icon: '🤩' },
    { id: 'serious', name: 'Serious', icon: '🧐' },
    { id: 'calm', name: 'Calm', icon: '😌' }
  ];

  const testPhrases = {
    en: "I've identified a rare Rolex Submariner from 1967. Excellent investment opportunity.",
    es: "He identificado un Rolex Submariner raro de 1967. Excelente oportunidad de inversión.",
    fr: "J'ai identifié une rare Rolex Submariner de 1967. Excellente opportunité d'investissement.",
    it: "Ho identificato un raro Rolex Submariner del 1967. Eccellente opportunità di investimento.",
    de: "Ich habe eine seltene Rolex Submariner von 1967 identifiziert. Ausgezeichnete Investitionsmöglichkeit.",
    pt: "Identifiquei um raro Rolex Submariner de 1967. Excelente oportunidade de investimento.",
    ru: "Я обнаружил редкий Rolex Submariner 1967 года. Отличная инвестиционная возможность.",
    zh: "我发现了一块1967年的稀有劳力士潜航者。绝佳的投资机会。",
    ja: "1967年の珍しいロレックス・サブマリーナを発見しました。素晴らしい投資機会です。",
    ko: "1967년산 희귀한 롤렉스 서브마리너를 발견했습니다. 훌륭한 투자 기회입니다.",
    ar: "لقد حددت ساعة رولكس صبمارينر نادرة من عام 1967. فرصة استثمارية ممتازة."
  };

  const filteredVoices = availableVoices.filter(voice => 
    voice.language === selectedLanguage || voice.language === 'multilingual'
  );

  const handleTestVoice = async () => {
    const testText = testPhrases[selectedLanguage] || testPhrases.en;
    
    await testVoice(testText, {
      ...voiceSettings,
      language: selectedLanguage
    });
  };

  const handleVoiceClone = async (files: File[]) => {
    try {
      const voiceId = await cloneVoice({
        name: 'My Custom Jarvis',
        description: 'Custom AI assistant voice',
        files
      });
      
      toast.success('Voice cloned successfully! It will be available in a few moments.');
    } catch (error) {
      toast.error('Failed to clone voice. Please try again.');
    }
  };

  const estimatedMonthlyCost = voiceManager?.estimateMonthlyCost(
    5000, // Average words per day
    currentVoice?.id || 'default',
    selectedProvider
  ) || 0;

  return (
    <Card className="p-6 space-y-6 bg-black/40 border-white/10">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Oracle Voice Customization
        </h3>
        <p className="text-sm text-muted-foreground">
          Personalize how Jarvis speaks to you across all languages and platforms.
        </p>
      </div>

      <Tabs defaultValue="presets" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="presets">Voice Library</TabsTrigger>
          <TabsTrigger value="settings">Fine Tuning</TabsTrigger>
          <TabsTrigger value="clone">Voice Cloning</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-4 mt-6">
          {/* Language Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Language</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {languages.map(lang => (
                <Button
                  key={lang.code}
                  variant={selectedLanguage === lang.code ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedLanguage(lang.code)}
                  className="flex items-center gap-1"
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-xs">{lang.code.toUpperCase()}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Voice Persona</label>
            <div className="grid gap-3">
              {filteredVoices.map(voice => (
                <motion.div
                  key={voice.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={`p-4 cursor-pointer transition-all ${
                      currentVoice?.id === voice.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    onClick={() => setCurrentVoice(voice)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{voice.name}</h4>
                          {voice.gender === 'male' && <User className="w-4 h-4 text-blue-500" />}
                          {voice.gender === 'female' && <User className="w-4 h-4 text-pink-500" />}
                          {voice.gender === 'neutral' && <Bot className="w-4 h-4 text-gray-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {voice.accent && `${voice.accent} accent • `}
                          {voice.style} style
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {voice.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestVoice();
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Provider Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-yellow-500" />
              <span>Estimated monthly cost:</span>
            </div>
            <span className="font-medium">${estimatedMonthlyCost.toFixed(2)}</span>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-6">
          {/* Speed Control */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Speaking Speed</label>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-12">Slow</span>
              <Slider
                value={[voiceSettings.speed]}
                onValueChange={([speed]) => setVoiceSettings(prev => ({ ...prev, speed }))}
                min={0.5}
                max={2.0}
                step={0.1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-12 text-right">Fast</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {voiceSettings.speed.toFixed(1)}x speed
            </p>
          </div>

          {/* Stability (for ElevenLabs) */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Voice Stability</label>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-16">Variable</span>
              <Slider
                value={[voiceSettings.stability]}
                onValueChange={([stability]) => setVoiceSettings(prev => ({ ...prev, stability }))}
                min={0}
                max={1}
                step={0.05}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-16 text-right">Stable</span>
            </div>
          </div>

          {/* Emotion Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Emotional Tone</label>
            <div className="grid grid-cols-5 gap-2">
              {emotions.map(emotion => (
                <Button
                  key={emotion.id}
                  variant={voiceSettings.emotion === emotion.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVoiceSettings(prev => ({ ...prev, emotion: emotion.id }))}
                  className="flex flex-col items-center gap-1 h-auto py-2"
                >
                  <span className="text-2xl">{emotion.icon}</span>
                  <span className="text-xs">{emotion.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Test Area */}
          <Card className="p-4 bg-white/5 border-white/10">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Test Your Settings</h4>
              <p className="text-xs text-muted-foreground">
                {testPhrases[selectedLanguage]}
              </p>
              <Button 
                onClick={handleTestVoice} 
                disabled={isProcessing}
                className="w-full"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                Test Voice Configuration
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="clone" className="space-y-6 mt-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-lg font-medium">Create Your Unique Voice</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Upload 3-5 audio samples of the voice you want to clone. 
                Each sample should be 10-30 seconds of clear speech.
              </p>
            </div>

            <div className="border-2 border-dashed border-white/20 rounded-lg p-8 hover:border-white/40 transition-colors">
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length >= 3) {
                    handleVoiceClone(files);
                  } else {
                    toast.error('Please upload at least 3 audio samples');
                  }
                }}
                className="hidden"
                id="voice-upload"
              />
              <label htmlFor="voice-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Drop audio files here</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </label>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">MP3</Badge>
              <Badge variant="outline">WAV</Badge>
              <Badge variant="outline">M4A</Badge>
              <Badge variant="outline">WEBM</Badge>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}