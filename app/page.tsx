'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Menu, X, Link as LinkIcon, StickyNote, ChevronDown } from 'lucide-react';
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
import { AnimatedContainer, StaggeredList } from '@/components/ui/animations';

export default function Home() {
  const { user, isLoading } = useAuth();
  const { currentFolder, folders } = useApp();
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

  const getCurrentFolderName = () => {
    if (!currentFolder) return 'All Links';
    const folder = folders.find(f => f.id === currentFolder);
    return folder ? folder.name : 'All Links';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileSidebarOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-background border-r border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-bold text-lg">Menu</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100vh-4rem)]">
              <Sidebar />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <h1 className="text-2xl font-bold">{getCurrentFolderName()}</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden sm:block">
                <SearchBar />
              </div>
              {activeTab === 'all' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Add</span>
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setIsLinkDialogOpen(true)}>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Add Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsNoteDialogOpen(true)}>
                      <StickyNote className="h-4 w-4 mr-2" />
                      Add Note
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  onClick={() => activeTab === 'links' ? setIsLinkDialogOpen(true) : setIsNoteDialogOpen(true)} 
                  size="sm"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">
                    Add {activeTab === 'links' ? 'Link' : 'Note'}
                  </span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Mobile Search Bar */}
          <div className="sm:hidden px-4 pb-4">
            <SearchBar />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all" className="font-medium">
                All
              </TabsTrigger>
              <TabsTrigger value="links" className="font-medium">
                <LinkIcon className="mr-2 h-5 w-5" />
                Links
              </TabsTrigger>
              <TabsTrigger value="notes" className="font-medium">
                <StickyNote className="mr-2 h-5 w-5" />
                Notes
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <CombinedList onEditLink={handleEditLink} onEditNote={handleEditNote} />
            </TabsContent>
            <TabsContent value="links">
              <LinksList onEditLink={handleEditLink} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesList onEditNote={handleEditNote} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Link Dialog */}
      <LinkDialog
        open={isLinkDialogOpen}
        onOpenChange={handleCloseLinkDialog}
        link={editingLink}
        defaultFolderId={currentFolder || undefined}
      />
      {/* Note Dialog */}
      <NoteDialog
        open={isNoteDialogOpen}
        onOpenChange={handleCloseNoteDialog}
        note={editingNote}
        defaultFolderId={currentFolder || undefined}
      />

      {/* PWA Install Prompts */}
      <PWAInstallPrompt />
      <IOSInstallPrompt />
    </div>
  );
}