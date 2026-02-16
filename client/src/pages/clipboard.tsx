import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SettingsPage } from "@/components/settings-page";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Clip, Tag, Bookmark, Prompt, Upload } from "@shared/schema";
import {
  Clipboard,
  Copy,
  Check,
  Pin,
  Trash2,
  Search,
  Plus,
  Tag as TagIcon,
  Star,
  FileText,
  Code,
  Settings,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Keyboard,
  RotateCcw,
  Save,
  MoreVertical,
  Inbox,
  Archive,
  Hash,
  Bot,
  Send,
  Loader2,
  MessageSquare,
  Zap,
  Lock,
  Globe,
  Key,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Link,
  CreditCard,
  X,
  GripVertical,
  Lightbulb,
  Bookmark as BookmarkIcon,
  Upload as UploadIcon,
  ExternalLink,
  FileUp,
  Palette,
  Download,
  Import,
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
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StructuredField {
  id: string;
  label: string;
  value: string;
  type: "text" | "password" | "url" | "email" | "phone" | "date" | "api_key";
  icon: string;
}

interface HotkeyConfig {
  id: string;
  action: string;
  keys: string;
  enabled: boolean;
}

interface AIWorkflow {
  id: string;
  command: string;
  name: string;
  prompt: string;
  icon: typeof Zap;
}

const fieldIcons: Record<string, typeof Key> = {
  text: FileText,
  password: Lock,
  url: Globe,
  email: Mail,
  phone: Phone,
  date: Calendar,
  api_key: Key,
};

const defaultHotkeys: HotkeyConfig[] = [
  { id: "1", action: "Show/Hide App", keys: "ctrl+shift+e", enabled: true },
  { id: "2", action: "Notes from Clipboard", keys: "ctrl+shift+p", enabled: true },
  { id: "3", action: "Toggle AI Chat", keys: "ctrl+space", enabled: true },
  { id: "4", action: "New Note", keys: "ctrl+n", enabled: true },
  { id: "5", action: "Save Note", keys: "ctrl+s", enabled: true },
  { id: "6", action: "Delete Note", keys: "ctrl+del", enabled: true },
  { id: "7", action: "Search Notes", keys: "ctrl+f", enabled: true },
  { id: "8", action: "Next Note", keys: "down", enabled: true },
  { id: "9", action: "Previous Note", keys: "up", enabled: true },
];

const aiWorkflows: AIWorkflow[] = [
  { id: "w1", command: "/summarize", name: "Summarize", prompt: "Summarize this content concisely", icon: FileText },
  { id: "w2", command: "/improve", name: "Improve Writing", prompt: "Improve the writing quality of this text", icon: Sparkles },
  { id: "w3", command: "/tags", name: "Suggest Tags", prompt: "Suggest relevant tags for this content", icon: TagIcon },
  { id: "w4", command: "/code", name: "Code Review", prompt: "Review this code for issues", icon: Code },
  { id: "w5", command: "/email", name: "Draft Email", prompt: "Draft a professional email", icon: Mail },
  { id: "w6", command: "/ideas", name: "Brainstorm", prompt: "Generate ideas related to this topic", icon: Lightbulb },
];

type SidebarCategory = "notes" | "all" | "starred" | "untagged" | "clipboard" | "snippets" | "prompts" | "bookmarks" | "uploads" | "tags" | "recycle";

const TAG_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#888888",
];

const BOOKMARK_CATEGORIES = ["All", "Dev", "Design", "Research", "Tools", "Social", "News", "Other"];

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClipboardPage() {
  const { data: clips = [] } = useQuery<Clip[]>({ queryKey: ["/api/clips"] });
  const { data: apiTags = [] } = useQuery<Tag[]>({ queryKey: ["/api/tags"] });
  const { data: bookmarks = [] } = useQuery<Bookmark[]>({ queryKey: ["/api/bookmarks"] });
  const { data: dbPrompts = [] } = useQuery<Prompt[]>({ queryKey: ["/api/prompts"] });
  const { data: uploads = [] } = useQuery<Upload[]>({ queryKey: ["/api/uploads"] });

  const createClip = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/clips", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clips"] }),
  });
  const updateClip = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/clips/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clips"] }),
  });
  const deleteClipMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clips/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/clips"] }),
  });

  const createTagMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tags", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tags"] }),
  });
  const deleteTagMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tags/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tags"] }),
  });

  const createBookmarkMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bookmarks", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] }),
  });
  const importBookmarksMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bookmarks/import", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] }),
  });
  const deleteBookmarkMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bookmarks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] }),
  });

  const createPromptMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/prompts", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/prompts"] }),
  });
  const deletePromptMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/prompts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/prompts"] }),
  });

  const createUploadMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/uploads", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/uploads"] }),
  });
  const deleteUploadMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/uploads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/uploads"] }),
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SidebarCategory>("all");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingFields, setEditingFields] = useState<StructuredField[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(defaultHotkeys);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: "user" | "assistant", content: string}[]>([
    { role: "assistant", content: "Hi! I'm your AI assistant. I can help you work with your notes and clipboard. Try typing /summarize to see available workflows, or just ask me anything!" }
  ]);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant that helps organize and manage clipboard content and notes. Be concise and helpful.");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);
  const [filteredWorkflows, setFilteredWorkflows] = useState<AIWorkflow[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<StructuredField["type"]>("text");

  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newClipTag, setNewClipTag] = useState("");

  const [bmTitle, setBmTitle] = useState("");
  const [bmUrl, setBmUrl] = useState("");
  const [bmDesc, setBmDesc] = useState("");
  const [bmCategory, setBmCategory] = useState("Dev");
  const [bmFilterCat, setBmFilterCat] = useState("All");
  const [showBmImport, setShowBmImport] = useState(false);
  const [bmImportJson, setBmImportJson] = useState("");

  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectedClip = clips.find(c => c.id === selectedClipId) || null;

  const allClipTags = Array.from(new Set(clips.flatMap(c => c.tags || []))).filter(Boolean);
  const allTagNames = Array.from(new Set([...apiTags.map(t => t.name), ...allClipTags]));

  const filteredClips = clips.filter(clip => {
    const matchesSearch = (clip.content || "").toLowerCase().includes(search.toLowerCase()) ||
                          (clip.title || "").toLowerCase().includes(search.toLowerCase());

    switch (selectedCategory) {
      case "notes":
        return matchesSearch && clip.category === "notes" && !clip.deleted;
      case "all":
        return matchesSearch && !clip.deleted;
      case "starred":
        return matchesSearch && clip.starred && !clip.deleted;
      case "untagged":
        return matchesSearch && (!clip.tags || clip.tags.length === 0) && !clip.deleted;
      case "clipboard":
        return matchesSearch && clip.category === "clipboard" && !clip.deleted;
      case "snippets":
        return matchesSearch && clip.category === "snippets" && !clip.deleted;
      case "prompts":
        return matchesSearch && clip.category === "prompts" && !clip.deleted;
      case "recycle":
        return matchesSearch && clip.deleted;
      default:
        if (typeof selectedCategory === "string" && selectedCategory.startsWith("tag:")) {
          const tag = selectedCategory.replace("tag:", "");
          return matchesSearch && clip.tags?.includes(tag) && !clip.deleted;
        }
        return matchesSearch && !clip.deleted;
    }
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  useEffect(() => {
    if (selectedClip) {
      setEditingContent(selectedClip.content || "");
      setEditingTitle(selectedClip.title || "");
      setEditingFields((selectedClip.fields as StructuredField[]) || []);
    }
  }, [selectedClipId, selectedClip?.updatedAt]);

  useEffect(() => {
    if (aiPrompt.startsWith("/")) {
      const cmd = aiPrompt.toLowerCase();
      const matches = aiWorkflows.filter(w => w.command.startsWith(cmd));
      setFilteredWorkflows(matches);
      setShowWorkflowMenu(matches.length > 0);
    } else {
      setShowWorkflowMenu(false);
    }
  }, [aiPrompt]);

  const handleCopy = async (clip: Clip) => {
    let textToCopy = clip.content;
    if (clip.isStructured && Array.isArray(clip.fields) && (clip.fields as StructuredField[]).length > 0) {
      textToCopy = (clip.fields as StructuredField[]).map(f => `${f.label}: ${f.value}`).join("\n");
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(clip.id);
      toast({ title: "Copied" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleSave = () => {
    if (!selectedClip) return;
    updateClip.mutate({
      id: selectedClip.id,
      content: editingContent,
      title: editingTitle,
      fields: editingFields,
    });
    toast({ title: "Saved" });
  };

  const handleDelete = (id: string) => {
    updateClip.mutate({ id, deleted: true });
    if (selectedClipId === id) setSelectedClipId(null);
    toast({ title: "Moved to Recycle Bin" });
  };

  const handleRestore = (id: string) => {
    updateClip.mutate({ id, deleted: false });
    toast({ title: "Restored" });
  };

  const handlePermanentDelete = (id: string) => {
    deleteClipMut.mutate(id);
    if (selectedClipId === id) setSelectedClipId(null);
    toast({ title: "Permanently deleted" });
  };

  const handleStar = (id: string) => {
    const clip = clips.find(c => c.id === id);
    if (clip) updateClip.mutate({ id, starred: !clip.starred });
  };

  const handlePin = (id: string) => {
    const clip = clips.find(c => c.id === id);
    if (clip) updateClip.mutate({ id, pinned: !clip.pinned });
  };

  const handleNewNote = async (category: string = "notes", isStructured = false) => {
    const title = category === "prompts" ? "New Prompt" : isStructured ? "New Structured Note" : "Untitled Note";
    const fields = isStructured ? [{ id: "f1", label: "Field 1", value: "", type: "text", icon: "text" }] : [];
    try {
      const res = await apiRequest("POST", "/api/clips", {
        title,
        content: "",
        category,
        pinned: false,
        starred: false,
        deleted: false,
        isStructured,
        fields,
        tags: [],
      });
      const newClip = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clips"] });
      setSelectedClipId(newClip.id);
      setEditingTitle(title);
      setEditingContent("");
      setEditingFields(fields as StructuredField[]);
      setShowAIChat(false);
    } catch {
      toast({ title: "Failed to create note", variant: "destructive" });
    }
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: StructuredField = {
      id: Date.now().toString(),
      label: newFieldLabel,
      value: "",
      type: newFieldType,
      icon: newFieldType
    };
    setEditingFields([...editingFields, newField]);
    setNewFieldLabel("");
    setNewFieldType("text");
    setShowAddField(false);
  };

  const handleRemoveField = (fieldId: string) => {
    setEditingFields(editingFields.filter(f => f.id !== fieldId));
  };

  const handleUpdateField = (fieldId: string, value: string) => {
    setEditingFields(editingFields.map(f =>
      f.id === fieldId ? { ...f, value } : f
    ));
  };

  const handleAddTagToClip = (tagName: string) => {
    if (!selectedClip || !tagName.trim()) return;
    const currentTags = selectedClip.tags || [];
    if (currentTags.includes(tagName.trim())) return;
    updateClip.mutate({ id: selectedClip.id, tags: [...currentTags, tagName.trim()] });
    setNewClipTag("");
    setShowTagPicker(false);
  };

  const handleRemoveTagFromClip = (tagName: string) => {
    if (!selectedClip) return;
    const currentTags = (selectedClip.tags || []).filter(t => t !== tagName);
    updateClip.mutate({ id: selectedClip.id, tags: currentTags });
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTagMut.mutate({ name: newTagName.trim(), color: newTagColor });
    setNewTagName("");
    setNewTagColor("#3b82f6");
    setShowCreateTag(false);
    toast({ title: "Tag created" });
  };

  const handleDeleteTag = (id: string) => {
    deleteTagMut.mutate(id);
    toast({ title: "Tag deleted" });
  };

  const handleSelectWorkflow = (workflow: AIWorkflow) => {
    setAiPrompt("");
    setShowWorkflowMenu(false);

    const context = selectedClip ? `\n\nContext from "${selectedClip.title}":\n${selectedClip.content}` : "";

    setAiMessages(prev => [...prev, { role: "user", content: `${workflow.command} - ${workflow.name}` }]);
    setAiLoading(true);

    setTimeout(() => {
      let response = "";
      switch (workflow.id) {
        case "w1":
          response = selectedClip
            ? `Here's a summary of "${selectedClip.title}":\n\n• Key points extracted from your note\n• Main action items identified\n• Core concepts highlighted for quick reference`
            : "Please select a note first, then I can summarize it for you.";
          break;
        case "w2":
          response = "I've analyzed the text. Here are my suggestions:\n\n1. Consider breaking long sentences into shorter ones\n2. Use more active voice\n3. Add transition words between paragraphs\n\nWould you like me to rewrite it?";
          break;
        case "w3":
          response = "Based on the content, I suggest these tags:\n\n#documentation #reference #important\n\nWould you like me to apply them?";
          break;
        case "w4":
          response = "Code review complete:\n\n✅ Syntax looks good\n⚠️ Consider adding error handling\n💡 Variable naming could be more descriptive\n\nWant me to suggest specific improvements?";
          break;
        case "w5":
          response = "I can help draft an email. Please provide:\n\n1. Who is the recipient?\n2. What's the main purpose?\n3. What tone? (formal/casual)\n\nOr just describe what you need!";
          break;
        case "w6":
          response = "Here are some ideas to brainstorm:\n\n💡 Expand on the core concept\n💡 Consider alternative approaches\n💡 Look for connections to other projects\n💡 What problems does this solve?\n\nWhat direction interests you most?";
          break;
        default:
          response = "Workflow executed. How can I help you further?";
      }
      setAiMessages(prev => [...prev, { role: "assistant", content: response }]);
      setAiLoading(false);
    }, 1200);
  };

  const handleAISubmit = () => {
    if (!aiPrompt.trim()) return;

    if (showWorkflowMenu && filteredWorkflows.length > 0) {
      handleSelectWorkflow(filteredWorkflows[0]);
      return;
    }

    const userMessage = aiPrompt;
    setAiMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setAiPrompt("");
    setAiLoading(true);

    setTimeout(() => {
      let response = "";
      const lowerMsg = userMessage.toLowerCase();

      if (lowerMsg.includes("list") && (lowerMsg.includes("note") || lowerMsg.includes("clip"))) {
        const noteList = clips.filter(c => !c.deleted).slice(0, 5).map(c => `• ${c.title}`).join("\n");
        response = `Here are your recent items:\n\n${noteList}\n\nWould you like me to do something with any of these?`;
      } else if (lowerMsg.includes("find") || lowerMsg.includes("search")) {
        response = `I can search through your ${clips.filter(c => !c.deleted).length} items. What are you looking for specifically?`;
      } else if (lowerMsg.includes("help")) {
        response = "I can help you with:\n\n• /summarize - Summarize notes\n• /improve - Improve writing\n• /tags - Suggest tags\n• /code - Code review\n• /email - Draft emails\n• /ideas - Brainstorm\n\nOr just ask me anything about your notes!";
      } else if (selectedClip) {
        response = `I see you have "${selectedClip.title}" selected. I can help you:\n\n• Summarize it\n• Improve the writing\n• Suggest tags\n• Find related items\n\nWhat would you like me to do?`;
      } else {
        response = "I'm ready to help! You can:\n\n• Select a note and ask me to work with it\n• Use /commands for quick workflows\n• Ask me to find or organize your content\n\nWhat would you like to do?";
      }

      setAiMessages(prev => [...prev, { role: "assistant", content: response }]);
      setAiLoading(false);
    }, 1000);
  };

  const getCategoryCount = (cat: SidebarCategory): number => {
    return clips.filter(clip => {
      switch (cat) {
        case "notes": return clip.category === "notes" && !clip.deleted;
        case "all": return !clip.deleted;
        case "starred": return clip.starred && !clip.deleted;
        case "untagged": return (!clip.tags || clip.tags.length === 0) && !clip.deleted;
        case "clipboard": return clip.category === "clipboard" && !clip.deleted;
        case "snippets": return clip.category === "snippets" && !clip.deleted;
        case "prompts": return clip.category === "prompts" && !clip.deleted;
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
    { id: "prompts", icon: MessageSquare, label: "Prompts" },
    { id: "bookmarks", icon: BookmarkIcon, label: "Bookmarks" },
    { id: "uploads", icon: UploadIcon, label: "Uploads" },
  ];

  const getFieldIcon = (type: StructuredField["type"]) => {
    const Icon = fieldIcons[type] || FileText;
    return <Icon className="w-4 h-4 text-muted-foreground" />;
  };

  const handleAddBookmark = () => {
    if (!bmUrl.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    let domain = "";
    try { domain = new URL(bmUrl).hostname; } catch { domain = bmUrl; }
    createBookmarkMut.mutate({
      title: bmTitle || bmUrl,
      url: bmUrl,
      description: bmDesc,
      domain,
      category: bmCategory.toLowerCase(),
      tags: [],
      favicon: null,
    });
    setBmTitle("");
    setBmUrl("");
    setBmDesc("");
    setBmCategory("Dev");
    toast({ title: "Bookmark added" });
  };

  const handleImportBookmarks = () => {
    try {
      const parsed = JSON.parse(bmImportJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const mapped = items.map((item: any) => {
        let domain = "";
        try { domain = new URL(item.url).hostname; } catch { domain = item.url || ""; }
        return {
          title: item.title || item.url || "",
          url: item.url || "",
          description: item.description || "",
          domain,
          category: item.category || "general",
          tags: item.tags || [],
          favicon: item.favicon || null,
        };
      });
      importBookmarksMut.mutate(mapped);
      setBmImportJson("");
      setShowBmImport(false);
      toast({ title: `Imported ${mapped.length} bookmarks` });
    } catch {
      toast({ title: "Invalid JSON", variant: "destructive" });
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".json") || file.name.endsWith(".csv") || file.name.endsWith(".log")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          createUploadMut.mutate({
            filename: file.name,
            content,
            mimeType: file.type || "text/plain",
            size: file.size,
          });
          toast({ title: `Uploaded ${file.name}` });
        };
        reader.readAsText(file);
      } else {
        toast({ title: "Only text files are supported", variant: "destructive" });
      }
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        createUploadMut.mutate({
          filename: file.name,
          content,
          mimeType: file.type || "text/plain",
          size: file.size,
        });
        toast({ title: `Uploaded ${file.name}` });
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUsePrompt = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.template);
      toast({ title: "Prompt copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const filteredBookmarks = bmFilterCat === "All" ? bookmarks : bookmarks.filter(b => b.category === bmFilterCat.toLowerCase());
  const selectedUpload = uploads.find(u => u.id === selectedUploadId) || null;

  const showBookmarksView = selectedCategory === "bookmarks" && !showAIChat;
  const showUploadsView = selectedCategory === "uploads" && !showAIChat;
  const showClipsList = !showBookmarksView && !showUploadsView;

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-56 border-r border-border/50 sidebar-gradient flex flex-col">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center glow-primary">
              <Clipboard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">ClipSync</span>
              <span className="block text-[10px] text-muted-foreground -mt-0.5">Clipboard Manager</span>
            </div>
          </div>
        </div>

        <div className="p-2">
          <Button
            onClick={() => {
              setShowAIChat(true);
              setSelectedClipId(null);
            }}
            variant={showAIChat ? "default" : "outline"}
            className={cn(
              "w-full justify-start gap-2 h-9 text-sm",
              showAIChat && "glow-primary"
            )}
            size="sm"
            data-testid="button-ai-chat"
          >
            <Bot className="w-4 h-4" />
            AI Assistant
          </Button>
        </div>

        <Separator className="mx-2" />

        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-full justify-start gap-2 h-8 text-sm"
                size="sm"
                data-testid="button-new-note"
              >
                <Plus className="w-4 h-4" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => handleNewNote("notes", false)} data-testid="menu-new-note">
                <FileText className="w-4 h-4 mr-2" />
                New Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewNote("notes", true)} data-testid="menu-new-structured">
                <CreditCard className="w-4 h-4 mr-2" />
                Structured Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewNote("snippets", false)} data-testid="menu-new-snippet">
                <Code className="w-4 h-4 mr-2" />
                New Snippet
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewNote("prompts", false)} data-testid="menu-new-prompt">
                <MessageSquare className="w-4 h-4 mr-2" />
                New Prompt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedCategory(item.id);
                  setShowAIChat(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  selectedCategory === item.id && !showAIChat
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                data-testid={`nav-${item.id}`}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.id !== "bookmarks" && item.id !== "uploads" && (
                  <span className="text-xs opacity-60">{getCategoryCount(item.id)}</span>
                )}
                {item.id === "bookmarks" && (
                  <span className="text-xs opacity-60">{bookmarks.length}</span>
                )}
                {item.id === "uploads" && (
                  <span className="text-xs opacity-60">{uploads.length}</span>
                )}
              </button>
            ))}

            <Separator className="my-2" />

            {/* Tags Section */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTagsExpanded(!tagsExpanded)}
                className="flex-1 flex items-center justify-between px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
              >
                <span className="flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags
                </span>
                {tagsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <Popover open={showCreateTag} onOpenChange={setShowCreateTag}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" data-testid="button-create-tag">
                    <Plus className="w-3 h-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Create Tag</h4>
                    <Input
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      data-testid="input-new-tag-name"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {TAG_COLORS.map(color => (
                          <button
                            key={color}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-all",
                              newTagColor === color ? "border-foreground scale-110" : "border-transparent"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewTagColor(color)}
                            data-testid={`tag-color-${color}`}
                          />
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleCreateTag} size="sm" className="w-full" data-testid="button-save-tag">
                      Create Tag
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <AnimatePresence>
              {tagsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-4 space-y-1 overflow-hidden"
                >
                  {apiTags.map(tag => (
                    <div key={tag.id} className="flex items-center group">
                      <button
                        onClick={() => {
                          setSelectedCategory(`tag:${tag.name}` as SidebarCategory);
                          setShowAIChat(false);
                        }}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                          selectedCategory === `tag:${tag.name}`
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                        data-testid={`tag-${tag.name}`}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => handleDeleteTag(tag.id)}
                        data-testid={`delete-tag-${tag.id}`}
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {allClipTags.filter(t => !apiTags.some(at => at.name === t)).map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedCategory(`tag:${tag}` as SidebarCategory);
                        setShowAIChat(false);
                      }}
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
              onClick={() => {
                setSelectedCategory("recycle");
                setShowAIChat(false);
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                selectedCategory === "recycle" && !showAIChat
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

        <div className="p-2 border-t border-border/50 space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
                data-testid="button-export-import"
              >
                <Download className="w-4 h-4" />
                Export / Import
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => {
                window.open("/api/export/all", "_blank");
              }}>
                <Download className="w-4 h-4 mr-2" />
                Export All (JSON)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                window.open("/api/export/prompts", "_blank");
              }}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Export Prompts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                window.open("/api/export/autohotkey", "_blank");
              }}>
                <Keyboard className="w-4 h-4 mr-2" />
                Export for AutoHotkey
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                window.open("/api/export/bookmarks", "_blank");
              }}>
                <BookmarkIcon className="w-4 h-4 mr-2" />
                Export Bookmarks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Middle Panel */}
      {showBookmarksView ? (
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <BookmarkIcon className="w-5 h-5 text-primary" />
              Bookmarks
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowBmImport(true)} data-testid="button-import-bookmarks">
                Import JSON
              </Button>
            </div>
          </div>

          <div className="p-3 border-b border-border/50 flex gap-2 overflow-x-auto">
            {BOOKMARK_CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={bmFilterCat === cat ? "default" : "ghost"}
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setBmFilterCat(cat)}
                data-testid={`bm-filter-${cat.toLowerCase()}`}
              >
                {cat}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <div className="p-4 border border-dashed border-border rounded-lg space-y-3">
                <h4 className="text-sm font-medium">Add Bookmark</h4>
                <Input placeholder="Title" value={bmTitle} onChange={e => setBmTitle(e.target.value)} data-testid="input-bm-title" />
                <Input placeholder="URL *" value={bmUrl} onChange={e => setBmUrl(e.target.value)} data-testid="input-bm-url" />
                <Input placeholder="Description" value={bmDesc} onChange={e => setBmDesc(e.target.value)} data-testid="input-bm-desc" />
                <div className="flex gap-2">
                  <Select value={bmCategory} onValueChange={setBmCategory}>
                    <SelectTrigger className="w-32" data-testid="select-bm-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKMARK_CATEGORIES.filter(c => c !== "All").map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddBookmark} size="sm" data-testid="button-add-bookmark">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                {filteredBookmarks.map(bm => (
                  <motion.div
                    key={bm.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border bg-card card-hover group"
                    data-testid={`bookmark-card-${bm.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4 text-primary/80" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm truncate" data-testid={`bm-title-${bm.id}`}>{bm.title}</h4>
                          <p className="text-xs text-muted-foreground truncate">{bm.domain}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(bm.url, "_blank")}
                          data-testid={`bm-open-${bm.id}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => { deleteBookmarkMut.mutate(bm.id); toast({ title: "Bookmark deleted" }); }}
                          data-testid={`bm-delete-${bm.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {bm.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2" data-testid={`bm-desc-${bm.id}`}>{bm.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">{bm.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(bm.createdAt)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {filteredBookmarks.length === 0 && (
                <div className="py-12 text-center">
                  <BookmarkIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No bookmarks found</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <Dialog open={showBmImport} onOpenChange={setShowBmImport}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Bookmarks</DialogTitle>
              </DialogHeader>
              <Textarea
                placeholder='Paste JSON array: [{"title": "...", "url": "...", "description": "...", "category": "dev"}]'
                value={bmImportJson}
                onChange={e => setBmImportJson(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                data-testid="textarea-bm-import"
              />
              <Button onClick={handleImportBookmarks} data-testid="button-confirm-import">
                Import
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      ) : showUploadsView ? (
        <div className="flex-1 flex">
          <div className="w-80 border-r border-border/50 flex flex-col bg-card/30">
            <div className="p-3 border-b border-border/50 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <UploadIcon className="w-5 h-5 text-primary" />
                Uploads
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-file"
              >
                <Plus className="w-4 h-4 mr-1" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.csv,.log,.xml,.html,.css,.js,.ts"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            <div
              className={cn(
                "drag-zone m-3 p-6 text-center",
                dragOver && "active"
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              data-testid="upload-drop-zone"
            >
              <FileUp className={cn("w-8 h-8 mx-auto mb-2 transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm text-muted-foreground">
                {dragOver ? "Drop files here" : "Drag & drop text files"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">.txt .md .json .csv .log</p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {uploads.map(upload => (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all group",
                      selectedUploadId === upload.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50 border border-transparent"
                    )}
                    onClick={() => setSelectedUploadId(upload.id)}
                    data-testid={`upload-item-${upload.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate" data-testid={`upload-name-${upload.id}`}>{upload.filename}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(upload.size)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(upload.createdAt)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => { e.stopPropagation(); deleteUploadMut.mutate(upload.id); toast({ title: "Upload deleted" }); if (selectedUploadId === upload.id) setSelectedUploadId(null); }}
                        data-testid={`upload-delete-${upload.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
                {uploads.length === 0 && (
                  <div className="py-12 text-center">
                    <UploadIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No uploads yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedUpload ? (
              <>
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold" data-testid="upload-detail-name">{selectedUpload.filename}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{selectedUpload.mimeType}</span>
                      <span>{formatFileSize(selectedUpload.size)}</span>
                      <span>{formatDate(selectedUpload.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(selectedUpload.content);
                      toast({ title: "Content copied" });
                    }}
                    data-testid="button-copy-upload"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap" data-testid="upload-content">{selectedUpload.content}</pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="font-medium mb-1">No file selected</h3>
                  <p className="text-sm text-muted-foreground">Select an upload to view its content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Middle Panel - Clip List */}
          <div className="w-80 border-r border-border/50 flex flex-col bg-card/30">
            <div className="p-3 border-b border-border/50">
              <div className="relative input-glow rounded-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search your notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-background/60 border-border/50"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
              <span className="capitalize">{String(selectedCategory).replace("tag:", "#")}</span>
              <span>{filteredClips.length} items</span>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {selectedCategory === "prompts" && dbPrompts.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Prompt Templates</div>
                    {dbPrompts.map(prompt => (
                      <motion.div
                        key={`prompt-${prompt.id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="prompt-card p-3.5 cursor-pointer"
                        data-testid={`prompt-card-${prompt.id}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ring-2 ring-offset-1 ring-offset-card" style={{ backgroundColor: prompt.color, boxShadow: `0 0 8px ${prompt.color}40` }} />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm" data-testid={`prompt-name-${prompt.id}`}>{prompt.name}</h4>
                            {prompt.shortDesc && (
                              <p className="text-xs text-muted-foreground mt-0.5">{prompt.shortDesc}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-2 font-mono">{prompt.template}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-[10px]">{prompt.category}</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px]"
                                onClick={() => handleUsePrompt(prompt)}
                                data-testid={`prompt-use-${prompt.id}`}
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Use Prompt
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => { deletePromptMut.mutate(prompt.id); toast({ title: "Prompt deleted" }); }}
                                data-testid={`prompt-delete-${prompt.id}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {filteredClips.length > 0 && (
                      <div className="px-2 py-1 mt-2 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Prompt Notes</div>
                    )}
                  </>
                )}

                {filteredClips.map((clip) => (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer clip-item",
                      selectedClipId === clip.id && !showAIChat
                        ? "active bg-primary/8 border border-primary/20"
                        : "border border-transparent"
                    )}
                    onClick={() => {
                      setSelectedClipId(clip.id);
                      setShowAIChat(false);
                    }}
                    data-testid={`clip-item-${clip.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-sm truncate flex-1">
                        {clip.pinned && <Pin className="w-3 h-3 inline mr-1 text-primary" />}
                        {clip.isStructured && <CreditCard className="w-3 h-3 inline mr-1 text-accent" />}
                        {clip.title}
                      </h3>
                      {clip.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {clip.isStructured
                        ? `${(clip.fields as any[])?.length || 0} fields`
                        : clip.content}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(clip.createdAt)}
                      </span>
                      {(clip.tags || []).slice(0, 2).map(tag => {
                        const tagObj = apiTags.find(t => t.name === tag);
                        return (
                          <span key={tag} className="tag-pill text-[10px]">
                            {tagObj && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagObj.color }} />}
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}

                {filteredClips.length === 0 && (selectedCategory !== "prompts" || dbPrompts.length === 0) && (
                  <div className="py-12 text-center">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No items found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Editor or AI Chat */}
          <div className="flex-1 flex flex-col">
            {showAIChat ? (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">AI Assistant</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSystemPrompt(true)}
                    className="text-xs"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    System Prompt
                  </Button>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4 max-w-2xl mx-auto">
                    {aiMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[80%] p-3.5 text-sm shadow-sm",
                          msg.role === "user"
                            ? "ai-bubble-user"
                            : "ai-bubble-assistant"
                        )}>
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                        </div>
                      </motion.div>
                    ))}
                    {aiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-xl p-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border/50">
                  <div className="max-w-2xl mx-auto">
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                      {aiWorkflows.slice(0, 4).map(wf => (
                        <Button
                          key={wf.id}
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs"
                          onClick={() => handleSelectWorkflow(wf)}
                        >
                          <wf.icon className="w-3 h-3 mr-1" />
                          {wf.name}
                        </Button>
                      ))}
                    </div>

                    <div className="relative">
                      <AnimatePresence>
                        {showWorkflowMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full mb-2 left-0 right-0 bg-popover border rounded-lg shadow-lg p-2"
                          >
                            {filteredWorkflows.map(wf => (
                              <button
                                key={wf.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                                onClick={() => handleSelectWorkflow(wf)}
                              >
                                <wf.icon className="w-4 h-4 text-primary" />
                                <span className="font-mono text-xs text-muted-foreground">{wf.command}</span>
                                <span>{wf.name}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-2">
                        <Input
                          ref={inputRef}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Ask AI or type / for workflows..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAISubmit();
                            }
                          }}
                          className="flex-1"
                          data-testid="input-ai"
                        />
                        <Button onClick={handleAISubmit} data-testid="button-ai-send">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Type <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd> for workflows • Press Enter to send
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedClip ? (
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

                <div className="p-3 border-b border-border/50 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Tags:</span>
                  {(selectedClip.tags || []).map(tag => {
                    const tagObj = apiTags.find(t => t.name === tag);
                    return (
                      <Badge key={tag} variant="secondary" className="text-xs group/tag cursor-default">
                        {tagObj && <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: tagObj.color }} />}
                        {!tagObj && <Hash className="w-3 h-3 mr-1" />}
                        {tag}
                        <button
                          className="ml-1 opacity-0 group-hover/tag:opacity-100"
                          onClick={() => handleRemoveTagFromClip(tag)}
                          data-testid={`remove-clip-tag-${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  <Popover open={showTagPicker} onOpenChange={setShowTagPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" data-testid="button-add-tag">
                        <Plus className="w-3 h-3 mr-1" />
                        Add tag
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Add Tag</h4>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Tag name"
                            value={newClipTag}
                            onChange={(e) => setNewClipTag(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddTagToClip(newClipTag); }}
                            className="flex-1"
                            data-testid="input-clip-tag"
                          />
                          <Button size="sm" onClick={() => handleAddTagToClip(newClipTag)} data-testid="button-confirm-add-tag">
                            Add
                          </Button>
                        </div>
                        {allTagNames.length > 0 && (
                          <>
                            <Separator />
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {allTagNames.filter(t => !(selectedClip.tags || []).includes(t)).map(tag => {
                                const tagObj = apiTags.find(t => t.name === tag);
                                return (
                                  <button
                                    key={tag}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                                    onClick={() => handleAddTagToClip(tag)}
                                    data-testid={`select-tag-${tag}`}
                                  >
                                    {tagObj ? (
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tagObj.color }} />
                                    ) : (
                                      <Hash className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedClip.isStructured ? (
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3 max-w-xl">
                      {editingFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2 group">
                          <div className="w-8 flex justify-center">
                            {getFieldIcon(field.type)}
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <Input
                              value={field.label}
                              onChange={(e) => {
                                const updated = [...editingFields];
                                updated[index].label = e.target.value;
                                setEditingFields(updated);
                              }}
                              className="col-span-1 h-9 text-sm font-medium"
                              placeholder="Label"
                            />
                            <Input
                              type={field.type === "password" ? "password" : "text"}
                              value={field.value}
                              onChange={(e) => handleUpdateField(field.id, e.target.value)}
                              className="col-span-2 h-9 text-sm font-mono"
                              placeholder="Value"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveField(field.id)}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}

                      <Popover open={showAddField} onOpenChange={setShowAddField}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="mt-4">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Field
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Add New Field</h4>
                            <Input
                              placeholder="Field label"
                              value={newFieldLabel}
                              onChange={(e) => setNewFieldLabel(e.target.value)}
                            />
                            <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as StructuredField["type"])}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="password">Password</SelectItem>
                                <SelectItem value="url">URL</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="api_key">API Key</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button onClick={handleAddField} size="sm" className="w-full">
                              Add Field
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex-1 p-4">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-full h-full resize-none font-mono text-sm bg-transparent border-none focus:ring-0"
                      placeholder="Tap here to add text"
                      data-testid="textarea-content"
                    />
                  </div>
                )}

                <div className="p-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(selectedClip.createdAt)}
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
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-medium mb-1">No note selected</h3>
                  <p className="text-sm text-muted-foreground mb-4">Select a note to view or edit</p>
                  <Button variant="outline" size="sm" onClick={() => handleNewNote("notes")}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create a note
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* System Prompt Dialog */}
      <Dialog open={showSystemPrompt} onOpenChange={setShowSystemPrompt}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              System Prompt
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
            placeholder="Enter system prompt..."
          />
          <Button onClick={() => setShowSystemPrompt(false)}>Done</Button>
        </DialogContent>
      </Dialog>

      {/* Hotkeys Sheet */}
      <Sheet open={showHotkeys} onOpenChange={setShowHotkeys}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full mt-4">
            <div className="space-y-2 pr-4">
              {hotkeys.map(hk => (
                <div key={hk.id} className="flex items-center justify-between py-2">
                  <span className="text-sm">{hk.action}</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                    {hk.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Settings */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
    </div>
  );
}
