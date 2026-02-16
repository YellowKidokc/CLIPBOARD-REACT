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
  Paperclip,
  ClipboardPaste,
  BookOpen,
  Scissors,
  AlertCircle,
  GlobeLock,
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
  { id: "w1", command: "/summarize", name: "Summarize", prompt: "Summarize this content concisely, extracting the key points and main ideas.", icon: FileText },
  { id: "w2", command: "/axioms", name: "Extract Axioms", prompt: "Extract the core axioms, first principles, and foundational assumptions from this content. List them clearly.", icon: BookOpen },
  { id: "w3", command: "/improve", name: "Improve Writing", prompt: "Improve the writing quality of this text while preserving the original meaning.", icon: Sparkles },
  { id: "w4", command: "/tags", name: "Suggest Tags", prompt: "Suggest relevant tags for this content. Return them as a comma-separated list.", icon: TagIcon },
  { id: "w5", command: "/code", name: "Code Review", prompt: "Review this code for issues, bugs, and improvements. Be specific.", icon: Code },
  { id: "w6", command: "/rate", name: "Rate & Analyze", prompt: "Rate this content on a scale of 1-10 for clarity, depth, and usefulness. Explain your rating.", icon: Star },
  { id: "w7", command: "/ideas", name: "Brainstorm", prompt: "Generate creative ideas related to this topic.", icon: Lightbulb },
  { id: "w8", command: "/email", name: "Draft Email", prompt: "Draft a professional email based on this content.", icon: Mail },
];

const systemPromptPresets = [
  { id: "default", name: "General Assistant", prompt: "You are a helpful assistant that helps organize and manage clipboard content and notes. Be concise and helpful." },
  { id: "researcher", name: "Researcher", prompt: "You are a research analyst. Extract key findings, cite sources, identify patterns, and provide structured analysis. Be thorough and academic." },
  { id: "coder", name: "Code Expert", prompt: "You are an expert software engineer. Analyze code for bugs, suggest improvements, explain algorithms, and follow best practices. Use code blocks for examples." },
  { id: "writer", name: "Writer/Editor", prompt: "You are a professional editor. Improve clarity, fix grammar, enhance style, and suggest better word choices. Maintain the author's voice." },
  { id: "axiom", name: "Axiom Extractor", prompt: "You are a philosopher and logician. Your job is to extract the core axioms, first principles, assumptions, and logical foundations from any content. Identify implicit assumptions and logical dependencies." },
  { id: "strategist", name: "Strategist", prompt: "You are a strategic advisor. Analyze situations, identify opportunities and risks, suggest action plans, and think long-term. Be practical and results-oriented." },
  { id: "teacher", name: "Teacher", prompt: "You are a patient and thorough teacher. Explain complex concepts simply, use analogies, provide examples, and check understanding. Adapt to the learner's level." },
  { id: "data", name: "Data Analyst", prompt: "You are a data analyst. Extract patterns, identify trends, create structured summaries, and present data-driven insights. Use tables and lists when helpful." },
  { id: "creative", name: "Creative Director", prompt: "You are a creative director. Generate innovative ideas, think outside the box, suggest unexpected connections, and push creative boundaries. Be bold and imaginative." },
  { id: "critic", name: "Devil's Advocate", prompt: "You are a critical thinker. Challenge assumptions, find weaknesses in arguments, suggest counter-arguments, and stress-test ideas. Be constructively critical." },
  { id: "custom", name: "Custom", prompt: "" },
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
  const [activeTool, setActiveTool] = useState<"" | "research" | "crawl" | "scrape" | "mcp">("");
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

  const [aiAttachments, setAiAttachments] = useState<{filename: string, content: string}[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("default");

  const [showResearch, setShowResearch] = useState(false);
  const [researchQuery, setResearchQuery] = useState("");
  const [researchUrls, setResearchUrls] = useState("");
  const [researchDepth, setResearchDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [researchRunning, setResearchRunning] = useState(false);
  const [researchStatus, setResearchStatus] = useState("");
  const [researchProgress, setResearchProgress] = useState(0);
  const [researchSources, setResearchSources] = useState<{url: string, success?: boolean, title?: string, error?: string}[]>([]);
  const [researchResult, setResearchResult] = useState("");

  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlMaxPages, setCrawlMaxPages] = useState(5);
  const [crawlQuery, setCrawlQuery] = useState("");
  const [crawlRunning, setCrawlRunning] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState("");
  const [crawlPages, setCrawlPages] = useState<{url: string, title?: string, contentLength?: number, error?: string, status?: string}[]>([]);
  const [crawlAnalysis, setCrawlAnalysis] = useState("");

  const [singleScrapeUrl, setSingleScrapeUrl] = useState("");
  const [singleScrapeRunning, setSingleScrapeRunning] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<{title: string, content: string, url: string, links: any[], contentLength: number}[]>([]);

  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
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

  const streamAIResponse = async (messages: {role: string, content: string}[], attachments?: {filename: string, content: string}[]) => {
    setAiLoading(true);
    setAiMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          systemPrompt: systemPrompt,
          attachments: attachments || aiAttachments,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "AI request failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullResponse += parsed.content;
                  setAiMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: fullResponse };
                    return updated;
                  });
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes("Unexpected")) throw parseErr;
              }
            }
          }
        }
      }
    } catch (e: any) {
      setAiMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${e.message}` };
        return updated;
      });
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelectWorkflow = (workflow: AIWorkflow) => {
    setAiPrompt("");
    setShowWorkflowMenu(false);

    const context = selectedClip
      ? `\n\nHere is the content from my note titled "${selectedClip.title}":\n\n${selectedClip.content}`
      : "";

    const userMsg = `${workflow.command} - ${workflow.name}${context}`;
    setAiMessages(prev => [...prev, { role: "user", content: `${workflow.command} - ${workflow.name}` }]);

    const chatHistory = aiMessages
      .filter(m => m.role !== "assistant" || m.content)
      .map(m => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: "user", content: `${workflow.prompt}${context}` });

    streamAIResponse(chatHistory);
  };

  const handleAISubmit = () => {
    if (!aiPrompt.trim()) return;

    if (showWorkflowMenu && filteredWorkflows.length > 0) {
      handleSelectWorkflow(filteredWorkflows[0]);
      return;
    }

    const userMessage = aiPrompt;
    const context = selectedClip
      ? `\n\n[Currently selected note: "${selectedClip.title}"]\n${selectedClip.content}`
      : "";

    setAiMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setAiPrompt("");

    const chatHistory = aiMessages
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: "user", content: userMessage + context });

    streamAIResponse(chatHistory);
  };

  const handleScrapeUrl = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message);
      }
      const data = await response.json();
      setAiAttachments(prev => [...prev, {
        filename: `web: ${data.title || scrapeUrl}`,
        content: data.content.substring(0, 20000),
      }]);
      toast({ title: "Page scraped", description: `Loaded ${data.contentLength.toLocaleString()} chars from ${data.title}` });
      setScrapeUrl("");
    } catch (e: any) {
      toast({ title: "Scrape failed", description: e.message, variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const handleAiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setAiAttachments(prev => [...prev, { filename: file.name, content }]);
        toast({ title: "File attached", description: file.name });
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const handleQuickPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const title = text.substring(0, 60).replace(/\n/g, " ") + (text.length > 60 ? "..." : "");
        await apiRequest("POST", "/api/clips", {
          title,
          content: text,
          category: "clipboard",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/clips"] });
        toast({ title: "Pasted from clipboard" });
      }
    } catch {
      toast({ title: "Clipboard access denied", description: "Try pasting manually", variant: "destructive" });
    }
  };

  const handleSaveAiResponse = (content: string) => {
    const title = content.substring(0, 60).replace(/\n/g, " ") + (content.length > 60 ? "..." : "");
    createClip.mutate({
      title,
      content,
      category: "notes",
      tags: ["ai-generated"],
    } as any);
    toast({ title: "Saved to notes" });
  };

  const handleStartResearch = async () => {
    if (!researchQuery.trim()) return;
    setResearchRunning(true);
    setResearchResult("");
    setResearchSources([]);
    setResearchStatus("Starting research...");
    setResearchProgress(0);

    const urlList = researchUrls.trim()
      ? researchUrls.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"))
      : undefined;

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: researchQuery,
          urls: urlList,
          depth: researchDepth,
          maxSources: 5,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Research failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResult = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "status") {
                  setResearchStatus(parsed.message);
                  if (parsed.progress !== undefined) setResearchProgress(parsed.progress);
                }
                if (parsed.type === "sources") {
                  setResearchSources(parsed.urls.map((u: string) => ({ url: u })));
                }
                if (parsed.type === "scrape_result") {
                  setResearchSources(prev => prev.map(s =>
                    s.url === parsed.url ? { ...s, success: parsed.success, title: parsed.title, error: parsed.error } : s
                  ));
                }
                if (parsed.type === "content") {
                  fullResult += parsed.content;
                  setResearchResult(fullResult);
                }
                if (parsed.type === "error") {
                  toast({ title: "Research issue", description: parsed.message, variant: "destructive" });
                }
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Research failed", description: e.message, variant: "destructive" });
    } finally {
      setResearchRunning(false);
      setResearchStatus("Complete");
      setResearchProgress(100);
    }
  };

  const handleSaveResearch = () => {
    if (!researchResult) return;
    const title = `Research: ${researchQuery.substring(0, 50)}`;
    createClip.mutate({
      title,
      content: researchResult,
      category: "notes",
      tags: ["research", "ai-generated"],
    } as any);
    toast({ title: "Research saved to notes" });
  };

  const handleStartCrawl = async () => {
    if (!crawlUrl.trim()) return;
    setCrawlRunning(true);
    setCrawlPages([]);
    setCrawlAnalysis("");
    setCrawlStatus("Starting crawl...");

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl, maxPages: crawlMaxPages, query: crawlQuery || undefined }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let analysis = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "status") setCrawlStatus(parsed.message);
                if (parsed.type === "crawling") {
                  setCrawlPages(prev => [...prev, { url: parsed.url, status: "crawling" }]);
                  setCrawlStatus(`Crawling ${parsed.visited}/${parsed.total}: ${parsed.url}`);
                }
                if (parsed.type === "page_done") {
                  setCrawlPages(prev => prev.map(p =>
                    p.url === parsed.url ? { ...p, title: parsed.title, contentLength: parsed.contentLength, status: "done" } : p
                  ));
                }
                if (parsed.type === "page_error") {
                  setCrawlPages(prev => prev.map(p =>
                    p.url === parsed.url ? { ...p, error: parsed.error, status: "error" } : p
                  ));
                }
                if (parsed.type === "analysis") {
                  analysis += parsed.content;
                  setCrawlAnalysis(analysis);
                }
                if (parsed.type === "complete") {
                  setCrawlStatus(`Crawl complete: ${parsed.pagesVisited} pages visited`);
                }
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Crawl failed", description: e.message, variant: "destructive" });
    } finally {
      setCrawlRunning(false);
    }
  };

  const handleSingleScrape = async () => {
    if (!singleScrapeUrl.trim()) return;
    setSingleScrapeRunning(true);
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: singleScrapeUrl }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message);
      }
      const data = await response.json();
      setScrapeResults(prev => [data, ...prev]);
      toast({ title: "Page scraped", description: `${data.title} - ${data.contentLength.toLocaleString()} chars` });
      setSingleScrapeUrl("");
    } catch (e: any) {
      toast({ title: "Scrape failed", description: e.message, variant: "destructive" });
    } finally {
      setSingleScrapeRunning(false);
    }
  };

  const handleLoadMcpTools = async () => {
    setMcpLoading(true);
    try {
      const response = await fetch("/api/mcp/tools");
      const data = await response.json();
      setMcpTools(data.tools || []);
    } catch (e: any) {
      toast({ title: "Failed to load MCP tools", description: e.message, variant: "destructive" });
    } finally {
      setMcpLoading(false);
    }
  };

  const handleSaveCrawlResults = () => {
    const content = crawlAnalysis || crawlPages.map(p => `${p.title || p.url}\n${p.url}\nContent: ${p.contentLength || 0} chars\n`).join("\n");
    createClip.mutate({
      title: `Crawl: ${crawlUrl.substring(0, 50)}`,
      content,
      category: "notes",
      tags: ["crawl", "ai-generated"],
    } as any);
    toast({ title: "Crawl results saved to notes" });
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
              setActiveTool("");
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
                  setActiveTool("");
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
                          setActiveTool("");
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
                        setActiveTool("");
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
                setActiveTool("");
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

            <Separator className="my-2" />
            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Tools</p>
            
            <button
              onClick={() => { setActiveTool("research"); setShowAIChat(true); setShowResearch(true); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                activeTool === "research" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
              data-testid="nav-research"
            >
              <Search className="w-4 h-4" />
              Deep Research
            </button>
            <button
              onClick={() => { setActiveTool("crawl"); setShowAIChat(false); setSelectedClipId(null); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                activeTool === "crawl" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
              data-testid="nav-crawl"
            >
              <Globe className="w-4 h-4" />
              Web Crawling
            </button>
            <button
              onClick={() => { setActiveTool("scrape"); setShowAIChat(false); setSelectedClipId(null); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                activeTool === "scrape" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
              data-testid="nav-scrape"
            >
              <Scissors className="w-4 h-4" />
              Web Scraping
            </button>
            <button
              onClick={() => { setActiveTool("mcp"); setShowAIChat(false); setSelectedClipId(null); handleLoadMcpTools(); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                activeTool === "mcp" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
              )}
              data-testid="nav-mcp"
            >
              <Zap className="w-4 h-4" />
              MCP Server
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
            onClick={handleQuickPaste}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50"
            data-testid="button-quick-paste"
          >
            <ClipboardPaste className="w-4 h-4" />
            Quick Paste
          </button>
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
                    <div className="flex items-center bg-muted rounded-lg p-0.5">
                      <button
                        onClick={() => setShowResearch(false)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all",
                          !showResearch ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Bot className="w-4 h-4" />
                        Chat
                      </button>
                      <button
                        onClick={() => setShowResearch(true)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all",
                          showResearch ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Search className="w-4 h-4" />
                        Research
                      </button>
                    </div>
                    {!showResearch && aiAttachments.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {aiAttachments.length} attached
                      </Badge>
                    )}
                  </div>
                  {!showResearch && (
                    <div className="flex items-center gap-1">
                      <Select value={selectedPresetId} onValueChange={(v) => {
                        setSelectedPresetId(v);
                        const preset = systemPromptPresets.find(p => p.id === v);
                        if (preset && preset.id !== "custom") {
                          setSystemPrompt(preset.prompt);
                        }
                      }}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {systemPromptPresets.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowSystemPrompt(true)}
                        title="Edit system prompt"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setAiMessages([{ role: "assistant", content: "Chat cleared. How can I help?" }]);
                          setAiAttachments([]);
                        }}
                        title="Clear chat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {showResearch ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                      <div className="p-4 max-w-2xl mx-auto space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Research Topic</label>
                            <Input
                              placeholder="e.g., Latest advances in quantum computing..."
                              value={researchQuery}
                              onChange={(e) => setResearchQuery(e.target.value)}
                              disabled={researchRunning}
                              data-testid="input-research-query"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Specific URLs (optional)</label>
                            <Textarea
                              placeholder={"Paste URLs to research, one per line.\nLeave empty to auto-discover sources."}
                              value={researchUrls}
                              onChange={(e) => setResearchUrls(e.target.value)}
                              rows={3}
                              disabled={researchRunning}
                              className="text-sm font-mono"
                              data-testid="input-research-urls"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <div>
                              <label className="text-sm font-medium mb-1.5 block">Depth</label>
                              <Select value={researchDepth} onValueChange={(v: any) => setResearchDepth(v)}>
                                <SelectTrigger className="w-36 h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="quick">Quick</SelectItem>
                                  <SelectItem value="standard">Standard</SelectItem>
                                  <SelectItem value="deep">Deep</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex-1" />
                            <Button
                              onClick={handleStartResearch}
                              disabled={researchRunning || !researchQuery.trim()}
                              className="mt-auto"
                              data-testid="button-start-research"
                            >
                              {researchRunning ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Researching...
                                </>
                              ) : (
                                <>
                                  <Search className="w-4 h-4 mr-2" />
                                  Start Research
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {researchRunning && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {researchStatus}
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all duration-500"
                                style={{ width: `${researchProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {researchSources.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-sm font-medium">Sources</h3>
                            {researchSources.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                                {s.success === true && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                                {s.success === false && <X className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                {s.success === undefined && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
                                <span className="truncate flex-1">{s.title || s.url}</span>
                                {s.error && <span className="text-red-400 shrink-0">{s.error}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {researchResult && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium">Research Report</h3>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(researchResult);
                                    toast({ title: "Copied" });
                                  }}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={handleSaveResearch}
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  Save to Notes
                                </Button>
                              </div>
                            </div>
                            <div className="ai-bubble-assistant p-4 text-sm">
                              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{researchResult}</pre>
                            </div>
                          </div>
                        )}

                        {!researchRunning && !researchResult && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Enter a topic and start researching.</p>
                            <p className="text-xs mt-1">Deep Research scrapes multiple sources, analyzes them with AI, and creates a comprehensive report.</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                <>
                {aiAttachments.length > 0 && (
                  <div className="px-4 py-2 border-b border-border/50 flex gap-2 flex-wrap">
                    {aiAttachments.map((att, i) => (
                      <Badge key={i} variant="outline" className="text-xs gap-1 pr-1">
                        <Paperclip className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">{att.filename}</span>
                        <button onClick={() => setAiAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

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
                          "max-w-[80%] p-3.5 text-sm shadow-sm group relative",
                          msg.role === "user"
                            ? "ai-bubble-user"
                            : "ai-bubble-assistant"
                        )}>
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                          {msg.role === "assistant" && msg.content && i > 0 && (
                            <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  toast({ title: "Copied" });
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-background/50 hover:bg-background text-muted-foreground"
                                data-testid={`copy-ai-msg-${i}`}
                              >
                                <Copy className="w-3 h-3 inline mr-1" />Copy
                              </button>
                              <button
                                onClick={() => handleSaveAiResponse(msg.content)}
                                className="text-[10px] px-2 py-0.5 rounded bg-background/50 hover:bg-background text-muted-foreground"
                                data-testid={`save-ai-msg-${i}`}
                              >
                                <Save className="w-3 h-3 inline mr-1" />Save to Clip
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {aiLoading && aiMessages[aiMessages.length - 1]?.content === "" && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-xl p-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border/50">
                  <div className="max-w-2xl mx-auto">
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                      {aiWorkflows.map(wf => (
                        <Button
                          key={wf.id}
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs h-7"
                          onClick={() => handleSelectWorkflow(wf)}
                          disabled={aiLoading}
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
                            className="absolute bottom-full mb-2 left-0 right-0 bg-popover border rounded-lg shadow-lg p-2 z-10"
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
                        <div className="flex-1 flex gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Attach" disabled={aiLoading}>
                                <Paperclip className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                              <DropdownMenuItem onClick={() => aiFileInputRef.current?.click()}>
                                <FileUp className="w-4 h-4 mr-2" />
                                Upload File
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                if (selectedClip) {
                                  setAiAttachments(prev => [...prev, {
                                    filename: `clip: ${selectedClip.title}`,
                                    content: selectedClip.content,
                                  }]);
                                  toast({ title: "Attached current note" });
                                } else {
                                  toast({ title: "No note selected", variant: "destructive" });
                                }
                              }}>
                                <FileText className="w-4 h-4 mr-2" />
                                Attach Current Note
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={handleQuickPaste}>
                                <ClipboardPaste className="w-4 h-4 mr-2" />
                                Paste from Clipboard
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Scrape web page" disabled={aiLoading}>
                                <Globe className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Scrape Web Page</h4>
                                <p className="text-xs text-muted-foreground">Enter a URL to extract its content and attach it to the chat.</p>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="https://example.com/article"
                                    value={scrapeUrl}
                                    onChange={(e) => setScrapeUrl(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleScrapeUrl(); }}
                                    className="flex-1"
                                    data-testid="input-scrape-url"
                                  />
                                  <Button size="sm" onClick={handleScrapeUrl} disabled={scraping}>
                                    {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>

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
                            disabled={aiLoading}
                            data-testid="input-ai"
                          />
                        </div>
                        <Button onClick={handleAISubmit} disabled={aiLoading} data-testid="button-ai-send">
                          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                      <input
                        ref={aiFileInputRef}
                        type="file"
                        className="hidden"
                        accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.log"
                        multiple
                        onChange={handleAiFileUpload}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Type <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd> for workflows • Attach files or scrape pages for context
                      </p>
                    </div>
                  </div>
                </div>
                </>
                )}
              </div>
            ) : activeTool === "crawl" ? (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border/50 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Web Crawling</h2>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 max-w-2xl mx-auto space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Starting URL</label>
                        <Input
                          placeholder="https://example.com"
                          value={crawlUrl}
                          onChange={(e) => setCrawlUrl(e.target.value)}
                          disabled={crawlRunning}
                          data-testid="input-crawl-url"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Max Pages</label>
                          <Select value={String(crawlMaxPages)} onValueChange={(v) => setCrawlMaxPages(Number(v))}>
                            <SelectTrigger className="w-24 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="15">15</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <label className="text-sm font-medium mb-1.5 block">Analysis Query (optional)</label>
                          <Input
                            placeholder="What are you looking for?"
                            value={crawlQuery}
                            onChange={(e) => setCrawlQuery(e.target.value)}
                            disabled={crawlRunning}
                            data-testid="input-crawl-query"
                          />
                        </div>
                      </div>
                      <Button onClick={handleStartCrawl} disabled={crawlRunning || !crawlUrl.trim()} className="w-full" data-testid="button-start-crawl">
                        {crawlRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Crawling...</> : <><Globe className="w-4 h-4 mr-2" />Start Crawl</>}
                      </Button>
                    </div>

                    {crawlRunning && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {crawlStatus}
                      </div>
                    )}

                    {crawlPages.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">Crawled Pages ({crawlPages.length})</h3>
                          {!crawlRunning && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveCrawlResults}>
                              <Save className="w-3 h-3 mr-1" />Save Results
                            </Button>
                          )}
                        </div>
                        {crawlPages.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                            {p.status === "done" && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                            {p.status === "error" && <X className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            {p.status === "crawling" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{p.title || p.url}</p>
                              <p className="truncate text-muted-foreground">{p.url}</p>
                            </div>
                            {p.contentLength && <span className="text-muted-foreground shrink-0">{(p.contentLength / 1000).toFixed(1)}k</span>}
                            {p.error && <span className="text-red-400 shrink-0">{p.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {crawlAnalysis && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">AI Analysis</h3>
                        <div className="ai-bubble-assistant p-4 text-sm">
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{crawlAnalysis}</pre>
                        </div>
                      </div>
                    )}

                    {!crawlRunning && crawlPages.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Enter a URL to start crawling.</p>
                        <p className="text-xs mt-1">The crawler follows internal links from the starting page, extracts content, and optionally analyzes it with AI.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : activeTool === "scrape" ? (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border/50 flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Web Scraping</h2>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 max-w-2xl mx-auto space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">URL to Scrape</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://example.com/article"
                            value={singleScrapeUrl}
                            onChange={(e) => setSingleScrapeUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSingleScrape(); }}
                            disabled={singleScrapeRunning}
                            className="flex-1"
                            data-testid="input-single-scrape"
                          />
                          <Button onClick={handleSingleScrape} disabled={singleScrapeRunning || !singleScrapeUrl.trim()} data-testid="button-scrape">
                            {singleScrapeRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scrape"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {scrapeResults.length > 0 ? (
                      <div className="space-y-4">
                        {scrapeResults.map((result, i) => (
                          <div key={i} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="font-medium text-sm truncate">{result.title}</h3>
                                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">{result.url}</a>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                  navigator.clipboard.writeText(result.content);
                                  toast({ title: "Content copied" });
                                }}>
                                  <Copy className="w-3 h-3 mr-1" />Copy
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                  createClip.mutate({ title: result.title, content: result.content, category: "notes", tags: ["scraped"] } as any);
                                  toast({ title: "Saved to notes" });
                                }}>
                                  <Save className="w-3 h-3 mr-1" />Save
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                  setAiAttachments(prev => [...prev, { filename: `web: ${result.title}`, content: result.content.substring(0, 20000) }]);
                                  setShowAIChat(true);
                                  setActiveTool("");
                                  toast({ title: "Attached to AI chat" });
                                }}>
                                  <Paperclip className="w-3 h-3 mr-1" />Attach
                                </Button>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">{result.contentLength.toLocaleString()} chars</Badge>
                            {result.links && result.links.length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{result.links.length} links found</summary>
                                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                  {result.links.slice(0, 20).map((l: any, j: number) => (
                                    <a key={j} href={l.href} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline truncate">{l.text || l.href}</a>
                                  ))}
                                </div>
                              </details>
                            )}
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto bg-muted/50 rounded p-2">{result.content.substring(0, 2000)}{result.content.length > 2000 ? "..." : ""}</pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Scissors className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Enter a URL to extract its content.</p>
                        <p className="text-xs mt-1">Web Scraping extracts the text content, title, metadata, and links from any web page. Results can be copied, saved as notes, or attached to AI chat.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : activeTool === "mcp" ? (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">MCP Server</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLoadMcpTools} disabled={mcpLoading}>
                    {mcpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 max-w-2xl mx-auto space-y-4">
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <h3 className="font-medium text-sm">Connection Info</h3>
                      <p className="text-xs text-muted-foreground">External AI tools (Claude Desktop, ChatGPT, Cursor) can connect to ClipSync via these MCP endpoints to read and write your clips.</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">GET</Badge>
                          <code className="text-xs font-mono text-muted-foreground">/api/mcp/tools</code>
                          <span className="text-xs text-muted-foreground ml-auto">List available tools</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">POST</Badge>
                          <code className="text-xs font-mono text-muted-foreground">/api/mcp/call</code>
                          <span className="text-xs text-muted-foreground ml-auto">Execute a tool</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-medium text-sm">Available Tools ({mcpTools.length})</h3>
                      {mcpTools.length === 0 && !mcpLoading && (
                        <p className="text-sm text-muted-foreground">Click Refresh to load available tools.</p>
                      )}
                      {mcpTools.map((tool, i) => (
                        <div key={i} className="p-3 rounded-lg border space-y-2">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="font-mono text-sm font-medium">{tool.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{tool.description}</p>
                          {tool.inputSchema?.properties && (
                            <div className="text-xs space-y-1">
                              <p className="text-muted-foreground font-medium">Parameters:</p>
                              {Object.entries(tool.inputSchema.properties).map(([key, schema]: [string, any]) => (
                                <div key={key} className="flex items-center gap-2 pl-2">
                                  <code className="font-mono text-primary">{key}</code>
                                  <span className="text-muted-foreground">
                                    ({schema.type}{tool.inputSchema.required?.includes(key) ? ", required" : ""})
                                  </span>
                                  {schema.description && <span className="text-muted-foreground">- {schema.description}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <h3 className="font-medium text-sm">Usage Example</h3>
                      <p className="text-xs text-muted-foreground">To use with Claude Desktop, add this to your MCP config:</p>
                      <pre className="text-xs font-mono bg-background p-3 rounded overflow-x-auto">{`{
  "mcpServers": {
    "clipsync": {
      "url": "${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp"
    }
  }
}`}</pre>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify({
                          mcpServers: {
                            clipsync: {
                              url: `${window.location.origin}/api/mcp`
                            }
                          }
                        }, null, 2));
                        toast({ title: "Config copied to clipboard" });
                      }}>
                        <Copy className="w-3 h-3 mr-1" />Copy Config
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
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
