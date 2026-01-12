'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, ArrowRight, RefreshCw, Star, Clock, Zap, Eye, X, ExternalLink } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Link, Note } from '@/lib/types';
import { formatDistanceToNow, isSameDay, subYears } from 'date-fns';
import { trackLinkClick } from '@/lib/services/database';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [key, setKey] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Handle opening a link
  const handleOpenLink = useCallback((rec: Recommendation, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    if (rec.type === 'link') {
      const link = rec.item as Link;
      // Track the click
      if (user?.id) {
        trackLinkClick(link.id, user.id, 'direct').catch(() => {});
      }
      // Open the link in a new tab
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  }, [user?.id]);

  // Handle card click - for notes, open QuickLook; for links, open the URL
  const handleCardClick = useCallback((rec: Recommendation) => {
    if (rec.type === 'link') {
      const link = rec.item as Link;
      // Track the click
      if (user?.id) {
        trackLinkClick(link.id, user.id, 'direct').catch(() => {});
      }
      // Open the link in a new tab
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } else {
      // For notes, open QuickLook
      onQuickLook(rec.item, rec.type);
    }
  }, [user?.id, onQuickLook]);

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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Rediscover
            </h2>
            <p className="text-xs text-muted-foreground">Revisit your saved treasures</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-1.5"
            onClick={handleShuffle}
            disabled={isShuffling}
          >
            <motion.div
              animate={{ rotate: isShuffling ? 360 : 0 }}
              transition={{ duration: 0.4 }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.div>
            <span className="text-xs font-medium hidden sm:inline">Shuffle</span>
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {recommendations.map((rec, i) => {
            const isHovered = hoveredCard === rec.id;
            const isLink = rec.type === 'link';
            const item = rec.item;
            const title = isLink ? (item as Link).name : (item as Note).title;
            const url = isLink ? (item as Link).url : null;
            
            // Get clean hostname
            let hostname = '';
            if (url) {
              try {
                hostname = new URL(url).hostname.replace('www.', '');
              } catch {
                hostname = url;
              }
            }
            
            return (
              <motion.div
                key={`${rec.id}-${key}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                onClick={() => handleCardClick(rec)}
                onHoverStart={() => setHoveredCard(rec.id)}
                onHoverEnd={() => setHoveredCard(null)}
                className="group cursor-pointer"
              >
                <Card className="relative overflow-hidden border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                  {/* Subtle gradient accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${rec.color} opacity-80`} />
                  
                  <div className="p-4 space-y-3">
                    {/* Top row: Badge + Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md bg-gradient-to-br ${rec.color} text-white`}>
                          {rec.icon}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {rec.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isLink && (
                          <button
                            onClick={(e) => handleOpenLink(rec, e)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Open link"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickLook(rec.item, rec.type);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Quick look"
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-sm line-clamp-2 leading-snug text-foreground group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    
                    {/* URL for links */}
                    {isLink && hostname && (
                      <p className="text-xs text-muted-foreground truncate">
                        {hostname}
                      </p>
                    )}

                    {/* Footer: Date + CTA */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                      
                      <span className="text-xs text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isLink ? 'Open' : 'View'}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
