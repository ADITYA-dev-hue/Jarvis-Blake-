import React, { useState } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  Image as ImageIcon,
  Download,
  Plus,
  Trash2,
  Search
} from 'lucide-react';
import { FileItem } from './types';
import audioFx from '../../services/audioFx';

interface FilesScreenProps {
  onExecuteCommand: (action: string, params: Record<string, any>, label: string) => Promise<void>;
}

export const FilesScreen: React.FC<FilesScreenProps> = ({ onExecuteCommand }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [quickFolders] = useState([
    { name: 'Desktop', path: 'C:/Users/aditya/Desktop', icon: '💻', count: '14 items' },
    { name: 'Documents', path: 'C:/Users/aditya/Documents', icon: '📄', count: '48 items' },
    { name: 'Downloads', path: 'C:/Users/aditya/Downloads', icon: '⬇️', count: '124 items' },
    { name: 'Pictures', path: 'C:/Users/aditya/Pictures', icon: '🖼️', count: '89 items' },
    { name: 'Videos', path: 'C:/Users/aditya/Videos', icon: '🎬', count: '12 items' },
    { name: 'Projects', path: 'D:/Projects', icon: '⚡', count: '22 repos' },
    { name: 'JARVIS Vault', path: 'd:/JARVIS/workspace', icon: '🛡️', count: 'Sandbox' }
  ]);

  const [files, setFiles] = useState<FileItem[]>([
    { id: '1', name: 'agent.py', type: 'code', path: 'd:/JARVIS/laptop-agent/agent.py', size: '14.2 KB', modified: 'Today, 1:34 PM' },
    { id: '2', name: 'server.js', type: 'code', path: 'd:/JARVIS/server/server.js', size: '12.8 KB', modified: 'Today, 2:10 PM' },
    { id: '3', name: 'blake_hero.jpg', type: 'image', path: 'd:/JARVIS/phone-ui/public/blake_hero.jpg', size: '382 KB', modified: 'Today, 3:45 PM' },
    { id: '4', name: 'security_audit.pdf', type: 'file', path: 'd:/JARVIS/workspace/security_audit.pdf', size: '2.4 MB', modified: 'Yesterday' },
    { id: '5', name: 'system_telemetry.log', type: 'file', path: 'd:/JARVIS/workspace/telemetry.log', size: '840 KB', modified: 'Yesterday' }
  ]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const name = newFolderName.trim();
    audioFx.playClick();
    const folderPath = `workspace/${name}`;
    await onExecuteCommand('create_folder', { path: folderPath }, `Create Folder: ${folderPath}`);
    setFiles((prev) => [
      {
        id: `f-${Date.now()}`,
        name: `workspace/${name}`,
        type: 'folder',
        path: folderPath,
        modified: 'Just now'
      },
      ...prev
    ]);
    setNewFolderName('');
    setShowCreateModal(false);
    audioFx.playSuccess();
  };

  const handleDeleteFile = (id: string) => {
    audioFx.playClick();
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Title */}
      <div className="flex items-center justify-between pb-1 border-b border-red-950/60">
        <div>
          <h2 className="font-mono text-base font-bold text-white tracking-wider flex items-center gap-2">
            <Folder className="w-4 h-4 text-red-500" />
            REMOTE FILE MANAGER
          </h2>
          <p className="font-mono text-[10px] text-slate-400">Windows File System & Sandbox Browser</p>
        </div>
        <button
          onClick={() => { audioFx.playClick(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 border border-red-700 text-red-300 font-mono text-[10px] font-bold"
        >
          <Plus className="w-3 h-3" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Storage Drives */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-black/60 border border-slate-900 flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-300 font-bold">OS (C:) NVMe SSD</span>
            <span className="text-red-400">54%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: '54%' }} />
          </div>
          <span className="font-mono text-[9px] text-slate-500">280 GB / 512 GB</span>
        </div>

        <div className="p-3 rounded-xl bg-black/60 border border-slate-900 flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-300 font-bold">DATA (D:) NVMe</span>
            <span className="text-cyan-400">34%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400" style={{ width: '34%' }} />
          </div>
          <span className="font-mono text-[9px] text-slate-500">344 GB / 1000 GB</span>
        </div>
      </div>

      {/* Quick Access Folders */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1">
          QUICK SHORTCUTS
        </span>
        <div className="grid grid-cols-2 gap-2">
          {quickFolders.map((q, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-[#070b14]/90 border border-slate-900 hover:border-red-950 flex items-center gap-2.5 transition-all"
            >
              <span className="text-lg">{q.icon}</span>
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-white truncate">{q.name}</div>
                <div className="font-mono text-[9px] text-slate-500">{q.count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/60 border border-red-950/80">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files..."
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white placeholder-slate-500"
        />
      </div>

      {/* Recent Files List */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1">
          RECENT FILES ({filteredFiles.length})
        </span>

        <div className="flex flex-col gap-2">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="p-3 rounded-xl bg-[#070b14]/90 border border-slate-900 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-black/60 border border-slate-800 flex items-center justify-center shrink-0">
                  {file.type === 'code' && <FileCode className="w-4 h-4 text-blue-400" />}
                  {file.type === 'image' && <ImageIcon className="w-4 h-4 text-amber-400" />}
                  {file.type === 'file' && <FileText className="w-4 h-4 text-slate-300" />}
                  {file.type === 'folder' && <Folder className="w-4 h-4 text-red-400" />}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-white truncate">{file.name}</div>
                  <div className="font-mono text-[9px] text-slate-500">
                    {file.size ? `${file.size} • ` : ''}{file.modified}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => audioFx.playClick()}
                  className="p-1.5 text-slate-400 hover:text-cyan-400 rounded"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs p-5 rounded-2xl bg-[#070b14] border border-red-600/80 flex flex-col gap-3 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
            <h3 className="font-mono text-sm font-bold text-white">Create Safe Sandbox Folder</h3>
            <p className="font-mono text-[10px] text-slate-400">Created inside d:\JARVIS\workspace</p>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name (e.g. data_vault)"
              className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none focus:border-red-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-lg font-mono text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-1.5 rounded-lg bg-red-600 font-mono text-xs text-white font-bold"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesScreen;
