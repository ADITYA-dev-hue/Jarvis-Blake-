import React, { useState } from 'react';
import { Activity, Code, Globe, FileText, FolderPlus, FolderCheck } from 'lucide-react';
import CommandButton from './CommandButton';

interface QuickActionsProps {
  onExecute: (action: string, parameters: Record<string, any>, label: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onExecute,
  isLoading,
  disabled
}) => {
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('Projects/Phase2Test');
  const [folderError, setFolderError] = useState<string | null>(null);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = folderName.trim();
    if (!cleanName) {
      setFolderError('Folder name cannot be empty');
      return;
    }

    // Client-side quick check against obvious escape attempts
    if (
      cleanName.startsWith('/') ||
      cleanName.startsWith('\\') ||
      /^[a-zA-Z]:/.test(cleanName) ||
      cleanName.includes('..') ||
      cleanName.startsWith('\\\\')
    ) {
      setFolderError('Only safe relative workspace paths allowed (e.g. Projects/MyFolder).');
      return;
    }

    setFolderError(null);
    onExecute('create_folder', { name: cleanName }, `Create Folder (${cleanName})`);
    setShowFolderModal(false);
  };

  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <h2 className="text-xs font-mono font-semibold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Quick Actions
        </h2>
        <span className="text-[10px] font-mono text-slate-500">SAFE PRESETS</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <CommandButton
          label="System Status"
          sublabel="CPU • RAM • OS"
          onClick={() => onExecute('system_status', {}, 'System Status')}
          isLoading={isLoading}
          disabled={disabled}
          icon={<Activity className="w-4 h-4 text-cyan-400" />}
          className="h-16"
        />

        <CommandButton
          label="Open VS Code"
          sublabel="app: code"
          onClick={() => onExecute('open_app', { app: 'code' }, 'Open VS Code')}
          isLoading={isLoading}
          disabled={disabled}
          icon={<Code className="w-4 h-4 text-sky-400" />}
          className="h-16"
        />

        <CommandButton
          label="Open GitHub"
          sublabel="https://github.com"
          onClick={() => onExecute('open_url', { url: 'https://github.com' }, 'Open GitHub')}
          isLoading={isLoading}
          disabled={disabled}
          icon={<Globe className="w-4 h-4 text-blue-400" />}
          className="h-16"
        />

        <CommandButton
          label="Open Notepad"
          sublabel="app: notepad"
          onClick={() => onExecute('open_app', { app: 'notepad' }, 'Open Notepad')}
          isLoading={isLoading}
          disabled={disabled}
          icon={<FileText className="w-4 h-4 text-cyan-300" />}
          className="h-16"
        />

        <CommandButton
          label="Open Workspace"
          sublabel="File Explorer"
          onClick={() => onExecute('open_folder', { path: '' }, 'Open Workspace')}
          isLoading={isLoading}
          disabled={disabled}
          icon={<FolderCheck className="w-4 h-4 text-emerald-400" />}
          className="h-16"
        />

        <CommandButton
          label="List Workspace"
          sublabel="Files & Folders"
          onClick={() => onExecute('list_folder', { path: '' }, 'List Workspace')}
          isLoading={isLoading}
          disabled={disabled}
          icon={<Activity className="w-4 h-4 text-amber-400" />}
          className="h-16"
        />
      </div>

      {/* Create Folder Trigger */}
      <button
        type="button"
        onClick={() => setShowFolderModal(true)}
        disabled={disabled || isLoading}
        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-cyan-500/30 bg-slate-950/40 hover:border-cyan-400/60 hover:bg-slate-900/50 text-cyan-200/80 hover:text-cyan-200 text-xs font-mono flex items-center justify-center gap-2 transition-all disabled:opacity-50 select-none"
      >
        <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
        <span>Create Safe Workspace Folder...</span>
      </button>

      {/* Modal / Dialog for Create Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-cyan-500/40 rounded-2xl p-5 shadow-glow-cyan flex flex-col gap-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-mono text-sm font-semibold">
                <FolderCheck className="w-4 h-4 text-cyan-400" />
                <span>Create Workspace Folder</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="text-slate-400 hover:text-white text-base leading-none"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              Folders are created strictly within the JARVIS workspace. Absolute paths, drive letters, and traversal (..) are blocked.
            </p>

            <form onSubmit={handleCreateFolder} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-cyan-300/80">
                  Folder Path (relative):
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => {
                    setFolderName(e.target.value);
                    setFolderError(null);
                  }}
                  placeholder="e.g. Projects/Phase2Test"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
                {folderError && (
                  <span className="text-[11px] text-rose-400 font-mono mt-1">
                    {folderError}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-3 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <CommandButton
                  label="Create Folder"
                  onClick={() => {}}
                  isLoading={isLoading}
                  disabled={!folderName.trim()}
                  className="py-2 px-4 text-xs"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActions;
