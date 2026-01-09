import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clipboard, 
  Copy, 
  Check, 
  Pin, 
  Trash2, 
  Search, 
  Plus, 
  Clock, 
  Tag,
  Star,
  FileText,
  Code,
  Folder,
  Settings,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Keyboard,
  RotateCcw,
  X,
  Save,
  Edit3,
  MoreVertical,
  Inbox,
  Archive,
  Hash,
  Bot,
  Wand2,
  MessageSquare,
  Send,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ClipItem {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  pinned: boolean;
  starred: boolean;
  category: "clipboard" | "notes" | "snippets";
  tags: string[];
  deleted: boolean;
}

interface HotkeyConfig {
  id: string;
  action: string;
  keys: string;
  enabled: boolean;
}

const initialClips: ClipItem[] = [
  {
    id: "1",
    title: "API Endpoint",
    content: "https://api.example.com/v2/clipboard/sync",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    pinned: true,
    starred: true,
    category: "clipboard",
    tags: ["work", "api"],
    deleted: false
  },
  {
    id: "2", 
    title: "Install Command",
    content: "npm install @clipto/desktop --save\nyarn add @clipto/desktop",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    pinned: false,
    starred: false,
    category: "snippets",
    tags: ["code"],
    deleted: false
  },
  {
    id: "3",
    title: "Meeting Notes - Jan 9",
    content: "Discussed API integration for Synology NAS.\n\n- Need WebSocket connection for real-time sync\n- Consider Cloudflare Workers for edge deployment\n- Review security requirements\n- Test on Android device",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    pinned: false,
    starred: true,
    category: "notes",
    tags: ["meeting", "synology"],
    deleted: false
  },
  {
    id: "4",
    title: "Synology IP",
    content: "192.168.1.100:5000",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    pinned: true,
    starred: false,
    category: "clipboard",
    tags: ["network"],
    deleted: false
  },
  {
    id: "5",
    title: "SQL Query",
    content: "SELECT * FROM clipboard_items\nWHERE user_id = ?\nORDER BY created_at DESC\nLIMIT 100;",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    pinned: false,
    starred: false,
    category: "snippets",
    tags: ["sql", "database"],
    deleted: false
  },
  {
    id: "6",
    title: "Backup Reminder",
    content: "Remember to backup the Synology before updating DSM to version 7.2",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    pinned: false,
    starred: false,
    category: "notes",
    tags: [],
    deleted: false
  },
  {
    id: "7",
    title: "Old config",
    content: "{ \"debug\": true, \"port\": 3000 }",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    pinned: false,
    starred: false,
    category: "clipboard",
    tags: [],
    deleted: true
  }
];

const defaultHotkeys: HotkeyConfig[] = [
  { id: "1", action: "Show/Hide App", keys: "ctrl+shift+e", enabled: true },
  { id: "2", action: "Notes from Clipboard", keys: "ctrl+shift+p", enabled: true },
  { id: "3", action: "Save from Clipboard", keys: "", enabled: false },
  { id: "4", action: "Toggle Fullscreen Mode", keys: "ctrl+1", enabled: true },
  { id: "5", action: "Toggle Comfortable Mode", keys: "ctrl+2", enabled: true },
  { id: "6", action: "Toggle Compact Mode", keys: "ctrl+3", enabled: true },
  { id: "7", action: "Next Tag", keys: "ctrl+down", enabled: true },
  { id: "8", action: "Previous Tag", keys: "ctrl+up", enabled: true },
  { id: "9", action: "Next Note", keys: "down", enabled: true },
  { id: "10", action: "Previous Note", keys: "up", enabled: true },
  { id: "11", action: "New Note", keys: "ctrl+n", enabled: true },
  { id: "12", action: "Save Note", keys: "ctrl+s", enabled: true },
  { id: "13", action: "Delete Note", keys: "ctrl+del", enabled: true },
  { id: "14", action: "Copy Note", keys: "ctrl+c", enabled: true },
  { id: "15", action: "Search Notes", keys: "ctrl+f", enabled: true },
  { id: "16", action: "AI Assist", keys: "ctrl+space", enabled: true },
];

type SidebarCategory = "notes" | "all" | "starred" | "untagged" | "clipboard" | "snippets" | "tags" | "recycle";

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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ClipboardPage() {
  const [clips, setClips] = useState<ClipItem[]>(initialClips);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SidebarCategory>("all");
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(defaultHotkeys);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: "user" | "assistant", content: string}[]>([]);
  const { toast } = useToast();

  const allTags = Array.from(new Set(clips.flatMap(c => c.tags))).filter(Boolean);

  const filteredClips = clips.filter(clip => {
    const matchesSearch = clip.content.toLowerCase().includes(search.toLowerCase()) ||
                          clip.title.toLowerCase().includes(search.toLowerCase());
    
    switch (selectedCategory) {
      case "notes":
        return matchesSearch && clip.category === "notes" && !clip.deleted;
      case "all":
        return matchesSearch && !clip.deleted;
      case "starred":
        return matchesSearch && clip.starred && !clip.deleted;
      case "untagged":
        return matchesSearch && clip.tags.length === 0 && !clip.deleted;
      case "clipboard":
        return matchesSearch && clip.category === "clipboard" && !clip.deleted;
      case "snippets":
        return matchesSearch && clip.category === "snippets" && !clip.deleted;
      case "recycle":
        return matchesSearch && clip.deleted;
      default:
        if (selectedCategory.startsWith("tag:")) {
          const tag = selectedCategory.replace("tag:", "");
          return matchesSearch && clip.tags.includes(tag) && !clip.deleted;
        }
        return matchesSearch && !clip.deleted;
    }
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  useEffect(() => {
    if (selectedClip) {
      setEditingContent(selectedClip.content);
      setEditingTitle(selectedClip.title);
    }
  }, [selectedClip]);

  const handleCopy = async (clip: ClipItem) => {
    try {
      await navigator.clipboard.writeText(clip.content);
      setCopiedId(clip.id);
      toast({
        title: "Copied",
        description: "Content copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    if (!selectedClip) return;
    setClips(clips.map(clip => 
      clip.id === selectedClip.id 
        ? { ...clip, content: editingContent, title: editingTitle, timestamp: new Date() }
        : clip
    ));
    setSelectedClip({ ...selectedClip, content: editingContent, title: editingTitle });
    toast({ title: "Saved" });
  };

  const handleDelete = (id: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, deleted: true } : clip
    ));
    if (selectedClip?.id === id) setSelectedClip(null);
    toast({ title: "Moved to Recycle Bin" });
  };

  const handleRestore = (id: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, deleted: false } : clip
    ));
    toast({ title: "Restored" });
  };

  const handlePermanentDelete = (id: string) => {
    setClips(clips.filter(clip => clip.id !== id));
    if (selectedClip?.id === id) setSelectedClip(null);
    toast({ title: "Permanently deleted" });
  };

  const handleStar = (id: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, starred: !clip.starred } : clip
    ));
  };

  const handlePin = (id: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, pinned: !clip.pinned } : clip
    ));
  };

  const handleNewNote = () => {
    const newClip: ClipItem = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      timestamp: new Date(),
      pinned: false,
      starred: false,
      category: "notes",
      tags: [],
      deleted: false
    };
    setClips([newClip, ...clips]);
    setSelectedClip(newClip);
    setEditingTitle("Untitled Note");
    setEditingContent("");
  };

  const handleAISubmit = () => {
    if (!aiPrompt.trim()) return;
    
    const userMessage = aiPrompt;
    setAiMessages([...aiMessages, { role: "user", content: userMessage }]);
    setAiPrompt("");
    setAiLoading(true);

    setTimeout(() => {
      let response = "";
      if (userMessage.toLowerCase().includes("summarize") && selectedClip) {
        response = `Here's a summary of "${selectedClip.title}":\n\nThis note contains key information about ${selectedClip.tags.length > 0 ? selectedClip.tags.join(", ") : "your project"}. The main points are captured in a concise format for quick reference.`;
      } else if (userMessage.toLowerCase().includes("improve") || userMessage.toLowerCase().includes("rewrite")) {
        response = "I'd suggest reorganizing the content with clear headings and bullet points for better readability. Would you like me to apply these changes?";
      } else if (userMessage.toLowerCase().includes("tag") || userMessage.toLowerCase().includes("categorize")) {
        response = "Based on the content, I'd suggest these tags: #work, #reference, #important. Would you like me to add them?";
      } else {
        response = "I can help you with:\n• Summarizing notes\n• Improving writing\n• Suggesting tags\n• Organizing content\n• Finding related clips\n\nWhat would you like me to do?";
      }
      
      setAiMessages(prev => [...prev, { role: "assistant", content: response }]);
      setAiLoading(false);
    }, 1500);
  };

  const getCategoryCount = (cat: SidebarCategory): number => {
    return clips.filter(clip => {
      switch (cat) {
        case "notes": return clip.category === "notes" && !clip.deleted;
        case "all": return !clip.deleted;
        case "starred": return clip.starred && !clip.deleted;
        case "untagged": return clip.tags.length === 0 && !clip.deleted;
        case "clipboard": return clip.category === "clipboard" && !clip.deleted;
        case "snippets": return clip.category === "snippets" && !clip.deleted;
        case "recycle": return clip.deleted;
        default: return false;
      }
    }).length;
  };

  const sidebarItems: { id: SidebarCategory; icon: typeof FileText; label: string }[] = [
    { id: "notes", icon: FileText, label: "Notes" },
    { id: "all", icon: Inbox, label: "All" },
    { id: "starred", icon: Star, label: "Starred" },
    { id: "untagged", icon: Archive, label: "Untagged" },
    { id: "clipboard", icon: Clipboard, label: "Clipboard" },
    { id: "snippets", icon: Code, label: "Snippets" },
  ];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-56 border-r border-border/50 bg-sidebar flex flex-col">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
              <Clipboard className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">ClipSync</span>
          </div>
        </div>

        <div className="p-2">
          <Button 
            onClick={handleNewNote}
            className="w-full justify-start gap-2 h-8 text-sm"
            size="sm"
            data-testid="button-new-note"
          >
            <Plus className="w-4 h-4" />
            New Note
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedCategory(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  selectedCategory === item.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                data-testid={`nav-${item.id}`}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
                <span className="text-xs opacity-60">{getCategoryCount(item.id)}</span>
              </button>
            ))}

            <Separator className="my-2" />

            {/* Tags Section */}
            <button
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags
              </span>
              {tagsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            
            <AnimatePresence>
              {tagsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-4 space-y-1 overflow-hidden"
                >
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedCategory(`tag:${tag}` as SidebarCategory)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                        selectedCategory === `tag:${tag}`
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                      data-testid={`tag-${tag}`}
                    >
                      <Hash className="w-3 h-3" />
                      {tag}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <Separator className="my-2" />

            <button
              onClick={() => setSelectedCategory("recycle")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                selectedCategory === "recycle"
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              data-testid="nav-recycle"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Recycle Bin
              </span>
              <span className="text-xs opacity-60">{getCategoryCount("recycle")}</span>
            </button>
          </div>
        </ScrollArea>

        {/* Settings buttons */}
        <div className="p-2 border-t border-border/50 space-y-1">
          <button
            onClick={() => setShowHotkeys(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
            data-testid="button-hotkeys"
          >
            <Keyboard className="w-4 h-4" />
            Hotkeys
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </aside>

      {/* Middle Panel - Clip List */}
      <div className="w-80 border-r border-border/50 flex flex-col bg-card/30">
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search your notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background/50"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span className="capitalize">{selectedCategory.replace("tag:", "#")}</span>
          <span>{filteredClips.length} items</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredClips.map((clip) => (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "p-3 rounded-lg cursor-pointer transition-all",
                  selectedClip?.id === clip.id 
                    ? "bg-primary/10 border border-primary/30" 
                    : "hover:bg-muted/50 border border-transparent"
                )}
                onClick={() => setSelectedClip(clip)}
                data-testid={`clip-item-${clip.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-medium text-sm truncate flex-1">
                    {clip.pinned && <Pin className="w-3 h-3 inline mr-1 text-primary" />}
                    {clip.title}
                  </h3>
                  {clip.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {clip.content}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimeAgo(clip.timestamp)}
                  </span>
                  {clip.tags.slice(0, 2).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            ))}

            {filteredClips.length === 0 && (
              <div className="py-12 text-center">
                <Inbox className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No items found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Editor */}
      <div className="flex-1 flex flex-col">
        {selectedClip ? (
          <>
            <div className="p-3 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="bg-transparent border-none text-lg font-semibold focus:outline-none focus:ring-0"
                  placeholder="Untitled Note"
                  data-testid="input-title"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAI(true)}
                  className="h-8 w-8"
                  data-testid="button-ai"
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(selectedClip)}
                  className="h-8 w-8"
                  data-testid="button-copy"
                >
                  {copiedId === selectedClip.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleStar(selectedClip.id)}
                  className="h-8 w-8"
                  data-testid="button-star"
                >
                  <Star className={cn("w-4 h-4", selectedClip.starred && "text-yellow-500 fill-yellow-500")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePin(selectedClip.id)}
                  className="h-8 w-8"
                  data-testid="button-pin"
                >
                  <Pin className={cn("w-4 h-4", selectedClip.pinned && "text-primary")} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedClip.deleted ? (
                      <>
                        <DropdownMenuItem onClick={() => handleRestore(selectedClip.id)}>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Restore
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handlePermanentDelete(selectedClip.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Permanently
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={() => handleDelete(selectedClip.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Move to Recycle Bin
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="p-3 border-b border-border/50 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tags:</span>
              {selectedClip.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Hash className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add tag
              </Button>
            </div>

            <div className="flex-1 p-4">
              <Textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="min-h-full h-full resize-none font-mono text-sm bg-transparent border-none focus:ring-0"
                placeholder="Tap here to add text"
                data-testid="textarea-content"
              />
            </div>

            <div className="p-3 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatDate(selectedClip.timestamp)}
              </span>
              <Button 
                onClick={handleSave} 
                size="sm"
                className="gap-2"
                data-testid="button-save"
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-medium mb-1">No note selected</h3>
              <p className="text-sm text-muted-foreground">Select a note to view or edit</p>
            </div>
          </div>
        )}
      </div>

      {/* Hotkeys Sheet */}
      <Sheet open={showHotkeys} onOpenChange={setShowHotkeys}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Hotkey Observer
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm">
              <p className="mb-2">With this pane you can configure hotkeys to control the application and the actions within it.</p>
              <p className="text-muted-foreground">Some hotkeys are set by default. You can either clear them or reassign.</p>
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-1">
                {hotkeys.map(hotkey => (
                  <div 
                    key={hotkey.id}
                    className="flex items-center justify-between py-3 px-2 hover:bg-muted/30 rounded-md"
                  >
                    <span className="text-sm">{hotkey.action}</span>
                    <div className="flex items-center gap-2">
                      {hotkey.keys ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {hotkey.keys}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-6">
            <div className="space-y-6">
              {/* Clipboard Settings */}
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Clipboard className="w-4 h-4" />
                  Clipboard
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm">
                  <p>The rune allows the app to monitor the clipboard and automatically create notes with text from it.</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Notes from Clipboard</p>
                      <p className="text-xs text-muted-foreground">Automatically create notes from copied text</p>
                    </div>
                    <Switch data-testid="switch-notes-from-clipboard" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Universal Clipboard</p>
                      <p className="text-xs text-muted-foreground">Sync clipboard between all devices</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-universal-clipboard" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Run at Startup</p>
                      <p className="text-xs text-muted-foreground">Start app when system boots</p>
                    </div>
                    <Switch data-testid="switch-startup" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Auto-save Settings */}
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Point of No Return
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm">
                  <p>By default, when you create or edit a note, you must manually click the save button to confirm your changes.</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Save notes automatically</p>
                  <Switch data-testid="switch-autosave" />
                </div>
              </div>

              <Separator />

              {/* Hide on Copy */}
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  Blowing Copy
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm">
                  <p>When activated, any action of copying text inside ClipSync will hide the application.</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Hide on Copy</p>
                  <Switch data-testid="switch-hide-on-copy" />
                </div>
              </div>

              <Separator />

              {/* AI Settings */}
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Assistant
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm">
                  <p>Enable AI-powered features for summarizing, organizing, and improving your notes.</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Enable AI Features</p>
                  <Switch defaultChecked data-testid="switch-ai" />
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* AI Assistant Sheet */}
      <Sheet open={showAI} onOpenChange={setShowAI}>
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              AI Assistant
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col h-[calc(100vh-120px)]">
            <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-muted-foreground">I can help you summarize, improve, and organize your notes. Ask me anything!</p>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[85%] rounded-lg p-3 text-sm",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="mt-4 flex gap-2">
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask AI to help..."
                onKeyDown={(e) => e.key === "Enter" && handleAISubmit()}
                data-testid="input-ai"
              />
              <Button onClick={handleAISubmit} size="icon" data-testid="button-ai-send">
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setAiPrompt("Summarize this note")}>
                <Wand2 className="w-3 h-3 mr-2" />
                Summarize
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAiPrompt("Suggest tags for this")}>
                <Tag className="w-3 h-3 mr-2" />
                Suggest Tags
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAiPrompt("Improve the writing")}>
                <Edit3 className="w-3 h-3 mr-2" />
                Improve
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAiPrompt("Find related clips")}>
                <Search className="w-3 h-3 mr-2" />
                Find Related
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}