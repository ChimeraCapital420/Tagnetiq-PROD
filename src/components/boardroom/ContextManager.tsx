// FILE: src/components/boardroom/ContextManager.tsx
// Admin interface to manage AI Board company knowledge documents
// Supports drag-and-drop file uploads (.md, .txt, .docx)

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Plus,
  FileText,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Upload,
  Brain,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileUp,
  File,
  CheckCircle,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================
interface ContextDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;
  is_active: boolean;
  source_type?: 'manual' | 'upload' | 'api';
  source_filename?: string;
  created_at: string;
  updated_at: string;
}

interface ContextStats {
  total: number;
  active: number;
  estimated_tokens: number;
  categories: string[];
}

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================
const CATEGORIES = [
  { value: 'tech_stack', label: 'Tech Stack', color: 'bg-blue-500' },
  { value: 'company', label: 'Company Info', color: 'bg-purple-500' },
  { value: 'market', label: 'Market Data', color: 'bg-green-500' },
  { value: 'product', label: 'Product', color: 'bg-orange-500' },
  { value: 'financial', label: 'Financial', color: 'bg-yellow-500' },
  { value: 'legal', label: 'Legal', color: 'bg-red-500' },
  { value: 'strategy', label: 'Strategy', color: 'bg-indigo-500' },
  { value: 'general', label: 'General', color: 'bg-gray-500' },
];

const ACCEPTED_FILE_TYPES = [
  '.md',
  '.txt',
  '.markdown',
  '.json',
  'text/plain',
  'text/markdown',
  'application/json',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// =============================================================================
// COMPONENT
// =============================================================================
export const BoardroomContextManager: React.FC = () => {
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ContextDocument | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    priority: 5,
    is_active: true,
  });

  // ===========================================================================
  // API CALLS
  // ===========================================================================
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/context', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      setDocuments(data.documents || []);
      setStats(data.stats || null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Title and content are required');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const method = editingDoc ? 'PUT' : 'POST';
      const body = editingDoc 
        ? { id: editingDoc.id, ...formData }
        : formData;

      const response = await fetch('/api/boardroom/context', {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save document');

      toast.success(editingDoc ? 'Document updated' : 'Document added');
      setIsDialogOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/boardroom/context?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete document');

      toast.success('Document deleted');
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleToggleActive = async (doc: ContextDocument) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/context', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: doc.id,
          is_active: !doc.is_active,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      toast.success(`Document ${doc.is_active ? 'disabled' : 'enabled'}`);
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  // ===========================================================================
  // FILE UPLOAD
  // ===========================================================================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles: UploadedFile[] = [];
    
    for (const file of files) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 5MB)`);
        continue;
      }
      
      // Check file type
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_FILE_TYPES.includes(ext) && !ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }
      
      validFiles.push({
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
      });
    }
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Not authenticated');
      return;
    }

    let completed = 0;
    const total = uploadedFiles.length;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const uploadFile = uploadedFiles[i];
      
      // Update status to uploading
      setUploadedFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      try {
        // Read file as base64
        const base64 = await fileToBase64(uploadFile.file);
        
        const response = await fetch('/api/boardroom/context', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_content: base64,
            file_name: uploadFile.name,
            file_type: uploadFile.file.type,
            priority: 5,
            is_active: true,
          }),
        });

        if (!response.ok) throw new Error('Upload failed');

        // Update status to success
        setUploadedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success' } : f
        ));
        
        completed++;
        setUploadProgress((completed / total) * 100);
        
      } catch (error: any) {
        // Update status to error
        setUploadedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: error.message } : f
        ));
      }
    }

    toast.success(`Uploaded ${completed} of ${total} files`);
    fetchDocuments();
    
    // Clear successful uploads after a delay
    setTimeout(() => {
      setUploadedFiles(prev => prev.filter(f => f.status !== 'success'));
      setUploadProgress(0);
    }, 2000);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // ===========================================================================
  // HELPERS
  // ===========================================================================
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'general',
      priority: 5,
      is_active: true,
    });
    setEditingDoc(null);
    setActiveTab('manual');
  };

  const handleEdit = (doc: ContextDocument) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      priority: doc.priority,
      is_active: doc.is_active,
    });
    setActiveTab('manual');
    setIsDialogOpen(true);
  };

  const formatTokens = (tokens: number) => {
    if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? (
      <Badge variant="outline" className={cn('border-none text-white', cat.color)}>
        {cat.label}
      </Badge>
    ) : (
      <Badge variant="outline">{category}</Badge>
    );
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Board Knowledge Base
          </h2>
          <p className="text-muted-foreground">
            Documents here are injected into every board member's context
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
              setUploadedFiles([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDoc ? 'Edit Document' : 'Add Company Knowledge'}
                </DialogTitle>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'upload')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" disabled={!!editingDoc}>
                    <FileText className="h-4 w-4 mr-2" />
                    Manual Entry
                  </TabsTrigger>
                  <TabsTrigger value="upload" disabled={!!editingDoc}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </TabsTrigger>
                </TabsList>

                {/* Manual Entry Tab */}
                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Technical Architecture Report"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", cat.color)} />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority (1-10)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min={1}
                        max={10}
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content (Markdown supported)</Label>
                    <Textarea
                      id="content"
                      placeholder="Enter the document content..."
                      className="min-h-[250px] font-mono text-sm"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      ~{formatTokens(Math.ceil(formData.content.length / 4))} tokens
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active (visible to board members)</Label>
                  </div>
                </TabsContent>

                {/* Upload Tab */}
                <TabsContent value="upload" className="space-y-4 mt-4">
                  {/* Drop Zone */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                      isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                      "hover:border-primary/50"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <FileUp className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-1">
                      Drop files here or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports .md, .txt, .json (max 5MB each)
                    </p>
                    <input
                      type="file"
                      multiple
                      accept=".md,.txt,.markdown,.json"
                      onChange={handleFileInput}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Select Files
                      </label>
                    </Button>
                  </div>

                  {/* File List */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>Files to Upload</Label>
                      <div className="border rounded-lg divide-y">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                              <File className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatBytes(file.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {file.status === 'pending' && (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                              {file.status === 'uploading' && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              )}
                              {file.status === 'success' && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              {file.status === 'error' && (
                                <Badge variant="destructive">Error</Badge>
                              )}
                              {file.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFile(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <Progress value={uploadProgress} className="h-2" />
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                {activeTab === 'manual' ? (
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingDoc ? 'Update' : 'Add'} Document
                  </Button>
                ) : (
                  <Button 
                    onClick={uploadFiles} 
                    disabled={uploadedFiles.length === 0 || uploadedFiles.some(f => f.status === 'uploading')}
                  >
                    {uploadedFiles.some(f => f.status === 'uploading') && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Upload {uploadedFiles.filter(f => f.status === 'pending').length} Files
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total Documents</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatTokens(stats.estimated_tokens)}</div>
              <p className="text-xs text-muted-foreground">Est. Tokens</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.categories.length}</div>
              <p className="text-xs text-muted-foreground">Categories</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Token Warning */}
      {stats && stats.estimated_tokens > 50000 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="font-medium">High Token Count</p>
              <p className="text-sm text-muted-foreground">
                Your context is large ({formatTokens(stats.estimated_tokens)} tokens). 
                Consider disabling less critical documents to improve response quality.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Documents</CardTitle>
          <CardDescription>
            These documents give your AI board members context about TagNetIQ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents yet. Add your first document to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} className={!doc.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {doc.title}
                    </TableCell>
                    <TableCell>{getCategoryBadge(doc.category)}</TableCell>
                    <TableCell>{doc.priority}</TableCell>
                    <TableCell className="text-muted-foreground">
                      ~{formatTokens(Math.ceil(doc.content.length / 4))}
                    </TableCell>
                    <TableCell>
                      {doc.source_type === 'upload' ? (
                        <Badge variant="outline" className="text-xs">
                          <Upload className="h-3 w-3 mr-1" />
                          {doc.source_filename || 'Upload'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.is_active ? 'default' : 'secondary'}>
                        {doc.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(doc)}
                          title={doc.is_active ? 'Disable' : 'Enable'}
                        >
                          {doc.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(doc)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove "{doc.title}" from the board's knowledge base.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(doc.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BoardroomContextManager;