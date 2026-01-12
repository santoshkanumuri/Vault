'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Shuffle, ArrowRight, RefreshCw, Star } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Link, Note } from '@/lib/types';
import { formatDistanceToNow, isSameDay, subYears } from 'date-fns';
import { Badge } from './badge';

interface SerendipityWidgetProps {
  links: Link[];
  notes: Note[];
  onQuickLook: (item: Link | Note, type: 'link' | 'note') => void;
  className?: string;
}

type RecommendationType = 'throwback' | 'forgotten' | 'random';

interface Recommendation {
  id: string;
  type: 'link' | 'note';
  item: Link | Note;
  reason: RecommendationType;
  label: string;
  color: string;
}

export const SerendipityWidget: React.FC<SerendipityWidgetProps> = ({ 
  links, 
  notes, 
  onQuickLook,
  className 
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [key, setKey] = useState(0); // To force re-render/animation on shuffle

  const generateRecommendations = () => {
    if (links.length === 0 && notes.length === 0) return [];
    
    const recs: Recommendation[] = [];
    const allItems = [
      ...links.map(l => ({ type: 'link' as const, item: l, date: new Date(l.createdAt) })),
      ...notes.map(n => ({ type: 'note' as const, item: n, date: new Date(n.createdAt) }))
    ];

    if (allItems.length === 0) return [];

    // Helper to get random unique item
    const getRandomUnique = (pool: typeof allItems, existingIds: Set<string>): typeof allItems[0] | null => {
        const available = pool.filter(i => !existingIds.has(i.item.id));
        if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)]; // Fallback to duplicates if pool exhausted
        return available[Math.floor(Math.random() * available.length)];
    };

    const usedIds = new Set<string>();

    // 1. Find a "Throwback" (On this day or just oldest)
    const today = new Date();
    // Try to find something from exactly 1 or 2 years ago
    let throwbackItem = allItems.find(i => 
      isSameDay(new Date(i.date), subYears(today, 1)) || 
      isSameDay(new Date(i.date), subYears(today, 2))
    );
    
    // If no exact match, grab the oldest item
    if (!throwbackItem) {
        throwbackItem = [...allItems].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    }

    if (throwbackItem) {
      usedIds.add(throwbackItem.item.id);
      recs.push({
        id: `throwback-${throwbackItem.item.id}`,
        type: throwbackItem.type,
        item: throwbackItem.item,
        reason: 'throwback',
        label: 'Time Capsule',
        color: 'from-violet-500 to-purple-600'
      });
    }

    // 2. Find a "Forgotten Gem" (Random item older than 7 days) - Relaxed from 30 for testing
    const oldItems = allItems.filter(i => 
      new Date(i.date).getTime() < (Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    const randomOld = getRandomUnique(oldItems.length > 0 ? oldItems : allItems, usedIds);
    
    if (randomOld) {
      usedIds.add(randomOld.item.id);
      recs.push({
        id: `forgotten-${randomOld.item.id}`,
        type: randomOld.type,
        item: randomOld.item,
        reason: 'forgotten',
        label: 'Forgotten Gem',
        color: 'from-amber-500 to-orange-600'
      });
    }

    // 3. Find a "Random Spark" (Purely random from remaining)
    const randomPick = getRandomUnique(allItems, usedIds);
    
    if (randomPick) {
      usedIds.add(randomPick.item.id);
      recs.push({
        id: `random-${randomPick.item.id}`,
        type: randomPick.type,
        item: randomPick.item,
        reason: 'random',
        label: 'Random Pick',
        color: 'from-blue-500 to-cyan-600'
      });
    }

    return recs.slice(0, 3);
  };

  useEffect(() => {
    setRecommendations(generateRecommendations());
  }, [links.length, notes.length, key]);

  const handleShuffle = () => {
    setKey(prev => prev + 1);
  };

  if (!isVisible || recommendations.length === 0) return null;

  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Rediscover
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 hover:bg-muted"
            onClick={handleShuffle}
            title="Shuffle suggestions"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {recommendations.map((rec, i) => (
            <motion.div
              key={`${rec.id}-${key}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() => onQuickLook(rec.item, rec.type)}
              className="group cursor-pointer"
            >
              <Card className="relative h-32 overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 dark:bg-muted/20 bg-white">
                {/* Gradient Background */}
                <div className={`absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity bg-gradient-to-br ${rec.color}`} />
                
                {/* Decoration */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-2xl group-hover:scale-150 transition-transform duration-500" />
                
                <div className="relative h-full p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm border-none shadow-sm text-xs font-medium">
                      {rec.label}
                    </Badge>
                    <motion.div 
                        initial={{ opacity: 0, x: -5 }}
                        whileHover={{ opacity: 1, x: 0 }}
                        className="text-primary/50"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2 leading-relaxed mb-1 text-foreground/90 group-hover:text-primary transition-colors">
                      {rec.type === 'link' ? (rec.item as Link).name : (rec.item as Note).title}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(rec.item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
