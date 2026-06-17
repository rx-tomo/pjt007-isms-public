'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children?: Folder[];
}

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId?: string;
  currentFolderId?: string | null;
  onFolderSelect?: (folderId: string | null) => void;
  onFolderCreate?: (parentId: string | null, name: string) => Promise<void> | void;
  onFolderDelete?: (folderId: string) => Promise<void> | void;
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  onFolderCreate,
  onFolderDelete
}: FolderTreeProps) {
  const t = useTranslations();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Build tree structure from flat list
  const buildTree = (folders: Folder[]): Folder[] => {
    const folderMap = new Map<string, Folder>();
    const rootFolders: Folder[] = [];

    // First pass: create map
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Second pass: build tree
    folders.forEach(folder => {
      const currentFolder = folderMap.get(folder.id)!;
      if (folder.parentId && folderMap.has(folder.parentId)) {
        const parent = folderMap.get(folder.parentId)!;
        parent.children!.push(currentFolder);
      } else {
        rootFolders.push(currentFolder);
      }
    });

    return rootFolders;
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = async (parentId: string | null) => {
    const trimmed = newFolderName.trim();

    if (!onFolderCreate) {
      setCreatingFolder(null);
      setNewFolderName('');
      return;
    }

    if (!trimmed) {
      setCreatingFolder(null);
      setNewFolderName('');
      return;
    }

    try {
      await onFolderCreate(parentId, trimmed);
      if (parentId) {
        setExpandedFolders(prev => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
      setNewFolderName('');
      setCreatingFolder(null);
    } catch (error) {
      console.error('Folder creation failed', error);
    }
  };

  const renderFolder = (folder: Folder, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children && folder.children.length > 0;
    const isSelected = folder.id === selectedFolderId;

    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center px-2 py-1 hover:bg-surface-elevated cursor-pointer ${
            isSelected ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="mr-1 text-text-muted hover:text-text-secondary"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <span
            className={`flex-1 text-sm ${isSelected ? 'font-medium text-blue-600' : ''}`}
            onClick={() => onFolderSelect?.(folder.id)}
          >
            📁 {folder.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCreatingFolder(folder.id);
            }}
            className="ml-1 opacity-0 text-text-muted transition group-hover:opacity-100 hover:text-text-secondary text-xs"
          >
            +
          </button>
          {onFolderDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void onFolderDelete(folder.id);
              }}
              className="ml-1 opacity-0 text-text-muted transition group-hover:opacity-100 hover:text-red-500 text-xs"
              aria-label={t('documents.folders.delete')}
            >
              ×
            </button>
          )}
        </div>

        {creatingFolder === folder.id && (
          <div className="px-4 py-2" style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateFolder(folder.id);
                if (e.key === 'Escape') {
                  setCreatingFolder(null);
                  setNewFolderName('');
                }
              }}
              onBlur={() => void handleCreateFolder(folder.id)}
              placeholder={t('documents.folders.newFolderPlaceholder')}
              className="w-full px-2 py-1 text-sm border border-border rounded"
              autoFocus
            />
          </div>
        )}

        {isExpanded && hasChildren && (
          <div>
            {folder.children!.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(folders);

  return (
    <div className="bg-surface rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-primary">{t('documents.folders.title')}</h3>
        <button
          onClick={() => setCreatingFolder('root')}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {t('documents.folders.create_new')}
        </button>
      </div>

      {/* Root folder */}
      <div
        className={`group flex items-center px-2 py-1 hover:bg-surface-elevated cursor-pointer mb-2 ${
          selectedFolderId === 'root' ? 'bg-blue-50' : ''
        }`}
        onClick={() => onFolderSelect?.('root')}
      >
        <span className={`text-sm ${selectedFolderId === 'root' ? 'font-medium text-blue-600' : ''}`}>
          📁 {t('documents.folders.root')}
        </span>
      </div>

      {creatingFolder === 'root' && (
        <div className="px-4 py-2 ml-4">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateFolder(null);
              if (e.key === 'Escape') {
                setCreatingFolder(null);
                setNewFolderName('');
              }
            }}
            onBlur={() => void handleCreateFolder(null)}
            placeholder={t('documents.folders.newFolderPlaceholder')}
            className="w-full px-2 py-1 text-sm border border-border rounded"
            autoFocus
          />
        </div>
      )}

      {/* Folder tree */}
      <div className="mt-2">
        {tree.map(folder => renderFolder(folder))}
      </div>
    </div>
  );
}