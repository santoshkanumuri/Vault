'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  ExternalLink, 
  MousePointerClick,
  ChevronRight,
  Loader2,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getMostClickedLinks, trackLinkClick, type LinkAnalytics } from '@/lib/services/database';

interface MostUsedLinksProps {
  className?: string;
  limit?: number;
  compact?: boolean;
}

export const MostUsedLinks: React.FC<MostUsedLinksProps> = ({ 
  className = '',
  limit = 5,
  compact = false 
}) => {
  const { user } = useAuth();
  const [topLinks, setTopLinks] = useState<LinkAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!compact);

  const loadTopLinks = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const links = await getMostClickedLinks(user.id, limit, 30);
      setTopLinks(links);
    } catch (error) {
      console.warn('Failed to load top links:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => {
    loadTopLinks();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadTopLinks, 30000);
    return () => clearInterval(interval);
  }, [loadTopLinks]);

  const handleOpenLink = async (link: LinkAnalytics) => {
    // Track the click
    if (user?.id) {
      trackLinkClick(link.linkId, user.id, 'direct').catch(() => {});
    }
    window.open(link.linkUrl, '_blank', 'noopener,noreferrer');
    
    // Refresh the list after a short delay
    setTimeout(loadTopLinks, 1000);
  };

  if (!user) return null;

  // Don't show if no data and not loading
  if (!isLoading && topLinks.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">Most Used</span>
          </div>
          <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1">
                  {topLinks.map((link, index) => (
                    <motion.button
                      key={link.linkId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleOpenLink(link)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left hover:bg-muted/50 transition-colors group"
                    >
                      <span className="text-xs font-medium text-muted-foreground w-4">
                        {index + 1}.
                      </span>
                      <span className="flex-1 text-sm truncate">
                        {link.linkName}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MousePointerClick className="w-3 h-3" />
                        <span>{link.totalClicks}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Most Used Links
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            Last 30 days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : topLinks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <MousePointerClick className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No click data yet</p>
            <p className="text-xs mt-1">Start using your links to see analytics</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topLinks.map((link, index) => (
              <motion.div
                key={link.linkId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <button
                  onClick={() => handleOpenLink(link)}
                  className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted/50 transition-all text-left"
                >
                  {/* Rank indicator */}
                  <div className={`
                    flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${index === 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : ''}
                    ${index === 1 ? 'bg-slate-400/20 text-slate-600 dark:text-slate-300' : ''}
                    ${index === 2 ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' : ''}
                    ${index > 2 ? 'bg-muted text-muted-foreground' : ''}
                  `}>
                    {index + 1}
                  </div>
                  
                  {/* Link info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {link.linkName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {new URL(link.linkUrl).hostname}
                    </p>
                  </div>
                  
                  {/* Click count */}
                  <div className="flex items-center gap-1.5 text-sm">
                    <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{link.totalClicks}</span>
                  </div>
                  
                  {/* External link icon */}
                  <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MostUsedLinks;
