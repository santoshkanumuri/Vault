'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Menu, X, Link as LinkIcon, StickyNote, ChevronDown, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/ui/layout/Sidebar';
import { SearchBar } from '@/components/ui/layout/SearchBar';
import { CombinedList } from '@/components/ui/CombinedList';
import { LinksList } from '@/components/ui/links/LinksList';
import { LinkDialog } from '@/components/ui/links/LinkDialog';
import { NotesList } from '@/components/ui/notes/NotesList';
import { NoteDialog } from '@/components/ui/notes/NoteDialog';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Link, Note } from '@/lib/types';
import { PWAInstallPrompt, IOSInstallPrompt } from '@/components/ui/pwa-install';
import { QuickCaptureButton } from '@/components/ui/QuickCaptureButton';
import { LoadingScreen, SlideIn, CardSkeleton, PageTransition } from '@/components/ui/animations';
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { currentFolder, folders, isLoading: appLoading, toggleDarkMode } = useApp();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const handleEditLink = (link: Link) => {
    setEditingLink(link);
    setIsLinkDialogOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsNoteDialogOpen(true);
  };

  const handleCloseLinkDialog = () => {
    setIsLinkDialogOpen(false);
    setEditingLink(null);
  };

  const handleCloseNoteDialog = () => {
    setIsNoteDialogOpen(false);
    setEditingNote(null);
  };

  const handleAddLink = () => {
    setEditingLink(null);
    // Use timeout to avoid focus fighting with DropdownMenu
    setTimeout(() => setIsLinkDialogOpen(true), 10);
  };

  const handleAddNote = () => {
    setEditingNote(null);
    // Use timeout to avoid focus fighting with DropdownMenu
    setTimeout(() => setIsNoteDialogOpen(true), 10);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewLink: handleAddLink,
    onNewNote: handleAddNote,
    onToggleDarkMode: toggleDarkMode,
    onCloseDialogs: () => {
      if (isLinkDialogOpen) handleCloseLinkDialog();
      if (isNoteDialogOpen) handleCloseNoteDialog();
    },
  });

  const getCurrentFolderName = () => {
    if (!currentFolder) return 'All Items';
    const folder = folders.find(f => f.id === currentFolder);
    return folder ? folder.name : 'All Items';
  };

  // Auth loading state
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Not authenticated
  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.div 
        className="hidden lg:flex w-72 flex-shrink-0"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.1 }}
      >
        <Sidebar />
      </motion.div>

      {/* Mobile Sidebar */}
      <SlideIn 
        isOpen={isMobileSidebarOpen} 
        direction="left"
        className="fixed left-0 top-0 h-full w-72 bg-card border-r border-border z-50 lg:hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-bold text-lg">Menu</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100vh-4rem)] overflow-y-auto">
          <Sidebar onNavigate={() => setIsMobileSidebarOpen(false)} />
        </div>
      </SlideIn>

      {/* Main Content */}
      <motion.div 
        className="flex-1 flex flex-col overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        {/* Header */}
        <motion.header 
          className="border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springConfig, delay: 0.2 }}
        >
          <div className="flex items-center justify-between p-4 lg:px-6">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden h-9 w-9 p-0"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="hidden sm:block">
                <motion.h1 
                  className="text-xl sm:text-2xl font-bold tracking-tight"
                  key={getCurrentFolderName()}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springConfig}
                >
                  {getCurrentFolderName()}
                </motion.h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Your digital sanctuary
                </p>
              </div>
            </div>
            
            {/* Centered Search Bar */}
            <div className="flex-1 flex justify-center px-4">
              <div className="w-full max-w-md">
                <SearchBar />
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Add Button */}
              {activeTab === 'all' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-1.5 shadow-glow-sm hover:shadow-glow transition-shadow">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add</span>
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem 
                      onClick={handleAddLink}
                      className="gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Add Link
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleAddNote}
                      className="gap-2"
                    >
                      <StickyNote className="h-4 w-4" />
                      Add Note
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  onClick={() => activeTab === 'links' ? handleAddLink() : handleAddNote()} 
                  size="sm"
                  className="gap-1.5 shadow-glow-sm hover:shadow-glow transition-shadow"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Add {activeTab === 'links' ? 'Link' : 'Note'}
                  </span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Mobile Title (below search) */}
          <div className="sm:hidden px-4 pb-2">
            <motion.h1 
              className="text-lg font-bold tracking-tight"
              key={getCurrentFolderName()}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springConfig}
            >
              {getCurrentFolderName()}
            </motion.h1>
          </div>
        </motion.header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <PageTransition className="p-4 lg:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger 
                  value="all" 
                  className="font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  All
                </TabsTrigger>
                <TabsTrigger 
                  value="links" 
                  className="font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Links
                </TabsTrigger>
                <TabsTrigger 
                  value="notes" 
                  className="font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <StickyNote className="mr-2 h-4 w-4" />
                  Notes
                </TabsTrigger>
              </TabsList>

              {/* Loading state */}
              {appLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <CardSkeleton />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    <TabsContent value="all" className="mt-0" key="all">
                      <CombinedList 
                        onEditLink={handleEditLink} 
                        onEditNote={handleEditNote}
                        onAddLink={handleAddLink}
                        onAddNote={handleAddNote}
                      />
                    </TabsContent>
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <TabsContent value="links" className="mt-0" key="links">
                      <LinksList 
                        onEditLink={handleEditLink}
                        onAddLink={handleAddLink}
                      />
                    </TabsContent>
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <TabsContent value="notes" className="mt-0" key="notes">
                      <NotesList 
                        onEditNote={handleEditNote}
                        onAddNote={handleAddNote}
                      />
                    </TabsContent>
                  </AnimatePresence>
                </>
              )}
            </Tabs>
          </PageTransition>
        </main>
      </motion.div>

      {/* Dialogs */}
      <LinkDialog
        open={isLinkDialogOpen}
        onOpenChange={handleCloseLinkDialog}
        link={editingLink}
        defaultFolderId={currentFolder || undefined}
      />

      <NoteDialog
        open={isNoteDialogOpen}
        onOpenChange={handleCloseNoteDialog}
        note={editingNote}
        defaultFolderId={currentFolder || undefined}
      />

      {/* PWA Install Prompts */}
      <PWAInstallPrompt />
      <IOSInstallPrompt />

      {/* Quick Capture FAB - shown on mobile and as additional desktop option */}
      <div className="lg:hidden">
        <QuickCaptureButton onAddLink={handleAddLink} onAddNote={handleAddNote} />
      </div>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsModal />

    </div>
  );
}
