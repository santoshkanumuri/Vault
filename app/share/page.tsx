'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Link as LinkIcon, FileText, Loader2, CheckCircle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

function ShareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { createLink, createNote, folders } = useApp();
  
  const [shareData, setShareData] = useState({
    title: '',
    text: '',
    url: '',
  });
  const [saveType, setSaveType] = useState<'link' | 'note'>('link');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get shared data from URL params - prioritize extracting URL
    const title = searchParams.get('title') || '';
    const text = searchParams.get('text') || '';
    const url = searchParams.get('url') || '';
    
    // Extract URL from various sources
    let extractedUrl = url;
    
    // Try to extract URL from text if not provided directly
    if (!extractedUrl && text) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        extractedUrl = urlMatch[0];
      }
    }
    
    // Try to extract URL from title (some apps put URL there)
    if (!extractedUrl && title) {
      const urlMatch = title.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        extractedUrl = urlMatch[0];
      }
    }
    
    // Clean up the URL (remove trailing punctuation)
    if (extractedUrl) {
      extractedUrl = extractedUrl.replace(/[.,;:!?)>\]}"']+$/, '');
    }
    
    // Only set the URL, let user fill rest
    setShareData({ title: '', text: '', url: extractedUrl });
    setSaveType('link');
  }, [searchParams]);

  const handleSave = async () => {
    if (!user) {
      setError('Please sign in to save');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const defaultFolderId = folders[0]?.id || '';
      
      if (saveType === 'link' && shareData.url) {
        await createLink(
          shareData.title || shareData.url,
          shareData.url,
          shareData.text || '',
          defaultFolderId,
          []
        );
      } else {
        await createNote(
          shareData.title || 'Shared Note',
          shareData.text || shareData.url || '',
          defaultFolderId,
          []
        );
      }
      
      setSaved(true);
      
      // Redirect to home after short delay
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      setError('Failed to save. Please try again.');
      console.error('Share save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Try to close the window (works when opened as share target)
    if (window.opener) {
      window.close();
    } else {
      router.push('/');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card border border-border rounded-xl p-6 text-center"
        >
          <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">Sign in Required</h1>
          <p className="text-muted-foreground mb-4">Please sign in to save shared content</p>
          <Button onClick={() => router.push('/')} className="w-full">
            Go to Vault
          </Button>
        </motion.div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card border border-border rounded-xl p-6 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
          >
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          </motion.div>
          <h1 className="text-xl font-semibold mb-2">Saved!</h1>
          <p className="text-muted-foreground">Redirecting to Vault...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card border border-border rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h1 className="text-lg font-semibold">Save to Vault</h1>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Type Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setSaveType('link')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                saveType === 'link'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <LinkIcon className="h-4 w-4" />
              Link
            </button>
            <button
              onClick={() => setSaveType('note')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                saveType === 'note'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <FileText className="h-4 w-4" />
              Note
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Title</label>
            <Input
              value={shareData.title}
              onChange={(e) => setShareData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={saveType === 'link' ? 'Link name' : 'Note title'}
            />
          </div>

          {/* URL (for links) */}
          {saveType === 'link' && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">URL</label>
              <div className="relative">
                <Input
                  value={shareData.url}
                  onChange={(e) => setShareData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://..."
                  className="pr-10"
                />
                {shareData.url && (
                  <a
                    href={shareData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Text/Content */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              {saveType === 'link' ? 'Description (optional)' : 'Content'}
            </label>
            <Textarea
              value={shareData.text}
              onChange={(e) => setShareData(prev => ({ ...prev, text: e.target.value }))}
              placeholder={saveType === 'link' ? 'Add a description...' : 'Note content...'}
              rows={4}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (saveType === 'link' && !shareData.url)}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
