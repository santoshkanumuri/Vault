'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Shuffle, ArrowRight, RefreshCw, Star, Clock, TrendingUp, Zap, Eye, X } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Link, Note } from '@/lib/types';
import { formatDistanceToNow, isSameDay, subYears, format } from 'date-fns';
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
  icon: React.ReactNode;
  description: string;
}

export const SerendipityWidget: React.FC<SerendipityWidgetProps> = ({ 
  links, 
  notes, 
  onQuickLook,
  className 
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [key, setKey] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

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
      const yearsAgo = Math.floor((Date.now() - throwbackItem.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      recs.push({
        id: `throwback-${throwbackItem.item.id}`,
        type: throwbackItem.type,
        item: throwbackItem.item,
        reason: 'throwback',
        label: 'Time Capsule',
        color: 'from-violet-500 to-purple-600',
        icon: <Clock className="w-4 h-4" />,
        description: yearsAgo > 0 ? `From ${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago` : 'Your oldest memory'
      });
    }

    // 2. Find a "Forgotten Gem" (Random item older than 7 days) - Relaxed from 30 for testing
    const oldItems = allItems.filter(i => 
      new Date(i.date).getTime() < (Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    const randomOld = getRandomUnique(oldItems.length > 0 ? oldItems : allItems, usedIds);
    
    if (randomOld) {
      usedIds.add(randomOld.item.id);
      const daysAgo = Math.floor((Date.now() - randomOld.date.getTime()) / (24 * 60 * 60 * 1000));
      recs.push({
        id: `forgotten-${randomOld.item.id}`,
        type: randomOld.type,
        item: randomOld.item,
        reason: 'forgotten',
        label: 'Forgotten Gem',
        color: 'from-amber-500 to-orange-600',
        icon: <Star className="w-4 h-4" />,
        description: daysAgo > 30 ? 'Worth revisiting' : 'Recently saved'
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
        color: 'from-blue-500 to-cyan-600',
        icon: <Zap className="w-4 h-4" />,
        description: 'Serendipity awaits'
      });
    }

    return recs.slice(0, 3);
  };

  useEffect(() => {
    setRecommendations(generateRecommendations());
  }, [links.length, notes.length, key]);

  const handleShuffle = () => {
    setIsShuffling(true);
    setTimeout(() => {
      setKey(prev => prev + 1);
      setIsShuffling(false);
    }, 300);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || recommendations.length === 0) return null;

  const getCardIcon = (reason: RecommendationType) => {
    switch (reason) {
      case 'throwback': return <Clock className="w-4 h-4" />;
      case 'forgotten': return <Star className="w-4 h-4" />;
      case 'random': return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <motion.div 
      className={`mb-8 ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <motion.div 
          className="flex items-center gap-3"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div 
            className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl text-primary shadow-lg shadow-primary/20"
            animate={{ 
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatDelay: 5
            }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
              Rediscover
            </h2>
            <p className="text-xs text-muted-foreground">Your personal time machine</p>
          </div>
        </motion.div>
        <motion.div 
          className="flex items-center gap-2"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 px-3 hover:bg-muted/80 hover:scale-105 transition-all gap-2 group"
            onClick={handleShuffle}
            disabled={isShuffling}
            title="Shuffle suggestions"
          >
            <motion.div
              animate={{ rotate: isShuffling ? 360 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </motion.div>
            <span className="text-xs font-medium hidden sm:inline">Shuffle</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive transition-all"
            onClick={handleDismiss}
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-1">
        <AnimatePresence mode="popLayout">
          {recommendations.map((rec, i) => {
            const isHovered = hoveredCard === rec.id;
            
            return (
              <motion.div
                key={`${rec.id}-${key}`}
                initial={{ opacity: 0, y: 30, scale: 0.9, rotateX: -15 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ 
                  delay: i * 0.15, 
                  type: 'spring', 
                  stiffness: 300, 
                  damping: 25,
                  opacity: { duration: 0.3 }
                }}
                whileHover={{ 
                  y: -8,
                  scale: 1.02,
                  transition: { type: 'spring', stiffness: 400, damping: 20 }
                }}
                onClick={() => onQuickLook(rec.item, rec.type)}
                onHoverStart={() => setHoveredCard(rec.id)}
                onHoverEnd={() => setHoveredCard(null)}
                className="group cursor-pointer perspective-1000"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <Card className="relative h-40 overflow-hidden border border-border/50 shadow-lg hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 dark:bg-gradient-to-br dark:from-muted/40 dark:to-muted/20 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
                  {/* Animated Gradient Background */}
                  <motion.div 
                    className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${rec.color}`}
                    animate={isHovered ? {
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, 0]
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  {/* Shimmer Effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={isHovered ? { x: '200%' } : { x: '-100%' }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                  />
                  
                  {/* Floating Orbs */}
                  <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 blur-3xl group-hover:scale-150 group-hover:opacity-40 transition-all duration-700" />
                  <div className="absolute -left-6 -bottom-6 w-28 h-28 rounded-full bg-gradient-to-tr from-blue-500/15 to-cyan-500/15 blur-2xl group-hover:scale-150 group-hover:opacity-40 transition-all duration-700" />
                  
                  <div className="relative h-full p-5 flex flex-col justify-between z-10">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <motion.div
                          className={`p-1.5 rounded-lg bg-gradient-to-br ${rec.color} text-white shadow-md`}
                          whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                          transition={{ duration: 0.5 }}
                        >
                          {rec.icon}
                        </motion.div>
                        <Badge 
                          variant="secondary" 
                          className="bg-background/90 backdrop-blur-md border-none shadow-sm text-xs font-semibold tracking-wide"
                        >
                          {rec.label}
                        </Badge>
                      </div>
                      
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
                        transition={{ duration: 0.2 }}
                        className={`p-1.5 rounded-full bg-primary/10 backdrop-blur-sm`}
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      </motion.div>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                      <motion.h3 
                        className="font-bold text-base line-clamp-2 leading-snug text-foreground group-hover:text-primary transition-colors duration-300"
                        animate={isHovered ? { x: [0, 2, 0] } : {}}
                        transition={{ duration: 0.3 }}
                      >
                        {rec.type === 'link' ? (rec.item as Link).name : (rec.item as Note).title}
                      </motion.h3>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDistanceToNow(new Date(rec.item.createdAt), { addSuffix: true })}</span>
                        </p>
                        
                        <motion.div
                          className="text-xs text-primary/70 font-medium flex items-center gap-1"
                          animate={isHovered ? { x: [0, 3, 0] } : {}}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        >
                          <span>{rec.description}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </motion.div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Accent Line */}
                  <motion.div
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${rec.color}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ transformOrigin: 'left' }}
                  />
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
