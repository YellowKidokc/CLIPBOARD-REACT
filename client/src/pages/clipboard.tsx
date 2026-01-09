import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clipboard, 
  Copy, 
  Check, 
  Pin, 
  PinOff, 
  Trash2, 
  Search, 
  Plus, 
  Clock, 
  Tag,
  Smartphone,
  Monitor,
  Cloud,
  Settings,
  RefreshCw,
  Filter,
  Star,
  StarOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ClipItem {
  id: string;
  content: string;
  timestamp: Date;
  pinned: boolean;
  starred: boolean;
  source: "desktop" | "mobile" | "cloud";
  category?: string;
}

const initialClips: ClipItem[] = [
  {
    id: "1",
    content: "https://github.com/your-repo/clipboard-sync",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    pinned: true,
    starred: false,
    source: "desktop",
    category: "links"
  },
  {
    id: "2", 
    content: "npm install clipboard-manager --save",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    pinned: false,
    starred: true,
    source: "desktop",
    category: "code"
  },
  {
    id: "3",
    content: "Meeting notes: Discussed API integration for Synology NAS. Need to set up WebSocket connection for real-time sync. Consider Cloudflare Workers for edge deployment.",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    pinned: false,
    starred: false,
    source: "mobile",
    category: "notes"
  },
  {
    id: "4",
    content: "192.168.1.100:5000",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    pinned: true,
    starred: false,
    source: "cloud",
    category: "network"
  },
  {
    id: "5",
    content: "SELECT * FROM clipboard_items WHERE user_id = ? ORDER BY created_at DESC LIMIT 100;",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    pinned: false,
    starred: true,
    source: "desktop",
    category: "code"
  },
  {
    id: "6",
    content: "Remember to backup the Synology before updating DSM to version 7.2",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    pinned: false,
    starred: false,
    source: "mobile",
    category: "notes"
  }
];

const categories = ["all", "links", "code", "notes", "network"];

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getSourceIcon(source: ClipItem["source"]) {
  switch (source) {
    case "desktop":
      return <Monitor className="w-3 h-3" />;
    case "mobile":
      return <Smartphone className="w-3 h-3" />;
    case "cloud":
      return <Cloud className="w-3 h-3" />;
  }
}

export default function ClipboardPage() {
  const [clips, setClips] = useState<ClipItem[]>(initialClips);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newClipContent, setNewClipContent] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const { toast } = useToast();

  const filteredClips = clips
    .filter(clip => {
      const matchesSearch = clip.content.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || clip.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  const handleCopy = async (clip: ClipItem) => {
    try {
      await navigator.clipboard.writeText(clip.content);
      setCopiedId(clip.id);
      toast({
        title: "Copied to clipboard",
        description: clip.content.length > 50 ? clip.content.substring(0, 50) + "..." : clip.content,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not access clipboard",
        variant: "destructive",
      });
    }
  };

  const handlePin = (id: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, pinned: !clip.pinned } : clip
    ));
  };

  const handleStar = (id: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, starred: !clip.starred } : clip
    ));
  };

  const handleDelete = (id: string) => {
    setClips(clips.filter(clip => clip.id !== id));
    toast({
      title: "Item deleted",
      description: "Clipboard item has been removed",
    });
  };

  const handleAddClip = () => {
    if (!newClipContent.trim()) return;
    
    const newClip: ClipItem = {
      id: Date.now().toString(),
      content: newClipContent.trim(),
      timestamp: new Date(),
      pinned: false,
      starred: false,
      source: "desktop",
      category: "notes"
    };
    
    setClips([newClip, ...clips]);
    setNewClipContent("");
    setIsAddDialogOpen(false);
    toast({
      title: "Item added",
      description: "New clipboard item has been saved",
    });
  };

  const handleSync = () => {
    toast({
      title: "Syncing...",
      description: "Connecting to sync server",
    });
    setTimeout(() => {
      toast({
        title: "Sync complete",
        description: "All devices are up to date",
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 glass sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
              <Clipboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">ClipSync</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {isConnected ? "Connected" : "Offline"}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSync}
              data-testid="button-sync"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clipboard history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-card-border"
              data-testid="input-search"
            />
          </div>
          
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-filter">
                  <Filter className="w-4 h-4" />
                  <span className="capitalize">{selectedCategory}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {categories.map(cat => (
                  <DropdownMenuItem 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="capitalize"
                    data-testid={`filter-option-${cat}`}
                  >
                    {cat}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 glow-primary" data-testid="button-add-clip">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Clip</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Textarea
                    placeholder="Paste or type content here..."
                    value={newClipContent}
                    onChange={(e) => setNewClipContent(e.target.value)}
                    className="min-h-[150px] font-mono text-sm"
                    data-testid="textarea-new-clip"
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddDialogOpen(false)}
                      data-testid="button-cancel-add"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddClip}
                      data-testid="button-save-clip"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          {filteredClips.length} item{filteredClips.length !== 1 ? 's' : ''} 
          {search && ` matching "${search}"`}
        </div>

        <ScrollArea className="h-[calc(100vh-280px)]">
          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {filteredClips.map((clip, index) => (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className={`
                    group relative p-4 rounded-lg border bg-card/50 
                    hover:bg-card transition-all duration-200
                    ${clip.pinned ? 'border-primary/30 bg-primary/5' : 'border-card-border'}
                  `}
                  data-testid={`clip-item-${clip.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {clip.pinned && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                            <Pin className="w-3 h-3 mr-1" />
                            Pinned
                          </Badge>
                        )}
                        {clip.starred && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                        {clip.category && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            <Tag className="w-3 h-3 mr-1" />
                            {clip.category}
                          </Badge>
                        )}
                      </div>
                      
                      <pre className="font-mono text-sm whitespace-pre-wrap break-all text-foreground/90 leading-relaxed">
                        {clip.content}
                      </pre>
                      
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(clip.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          {getSourceIcon(clip.source)}
                          <span className="capitalize">{clip.source}</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(clip)}
                        data-testid={`button-copy-${clip.id}`}
                      >
                        {copiedId === clip.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleStar(clip.id)}
                        data-testid={`button-star-${clip.id}`}
                      >
                        {clip.starred ? (
                          <StarOff className="w-4 h-4" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePin(clip.id)}
                        data-testid={`button-pin-${clip.id}`}
                      >
                        {clip.pinned ? (
                          <PinOff className="w-4 h-4" />
                        ) : (
                          <Pin className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(clip.id)}
                        data-testid={`button-delete-${clip.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {filteredClips.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Clipboard className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No clips found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {search 
                  ? `No items match "${search}". Try a different search term.`
                  : "Your clipboard history is empty. Copy something or add a new clip to get started."
                }
              </p>
            </div>
          )}
        </ScrollArea>
      </main>

      <footer className="border-t border-border/50 py-3 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <Monitor className="w-3 h-3" /> Desktop
          </span>
          <span className="flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> Mobile
          </span>
          <span className="flex items-center gap-1">
            <Cloud className="w-3 h-3" /> Cloud Sync Ready
          </span>
        </div>
      </footer>
    </div>
  );
}