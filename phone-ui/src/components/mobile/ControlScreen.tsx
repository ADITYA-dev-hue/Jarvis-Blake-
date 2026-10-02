import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  Activity,
  Laptop,
  Code,
  FileText,
  Globe,
  Folder,
  FolderOpen,
  FolderPlus,
  ListFilter,
  FileSearch,
  FilePlus,
  PlayCircle,
  Volume2,
  VolumeX,
  Sun,
  X
} from 'lucide-react';
import audioFx from '../../services/audioFx';

interface ControlScreenProps {
  onExecuteCommand: (action: string, params: Record<string, any>, label: string) => Promise<void>;
  onRequestConfirm: (action: string, params: Record<string, any>, label: string, desc: string) => void;
  isExecuting: boolean;
  stepMessage: string | null;
}

type ModalType = 'create_folder' | 'create_text_file' | 'get_file_info' | 'open_file' | null;

export const ControlScreen: React.FC<ControlScreenProps> = ({
  onExecuteCommand,
  isExecuting,
  stepMessage
}) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>("Ready for directives");

  // Modal form states
  const [folderNameInput, setFolderNameInput] = useState('');
  const [filePathInput, setFilePathInput] = useState('');
  const [fileContentInput, setFileContentInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Audio & brightness sliders
  const [volume, setVolume] = useState<number>(65);
  const [brightness, setBrightness] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const handleAction = async (action: string, params: Record<string, any>, label: string) => {
    audioFx.playClick();
    setLastActionStatus(`Dispatched: ${label}`);
    try {
      await onExecuteCommand(action, params, label);
      audioFx.playSuccess();
      setLastActionStatus(`Completed: ${label} ✓`);
    } catch (err: any) {
      audioFx.playAlert();
      setLastActionStatus(`Failed: ${err?.message || label}`);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (activeModal === 'create_folder') {
      const clean = folderNameInput.trim();
      if (!clean) {
        setModalError('Folder name is required.');
        return;
      }
      setActiveModal(null);
      await handleAction('create_folder', { name: clean }, `Create Folder (${clean})`);
      setFolderNameInput('');
    } else if (activeModal === 'create_text_file') {
      const cleanPath = filePathInput.trim();
      if (!cleanPath) {
        setModalError('File name is required (e.g. notes.txt, readme.md).');
        return;
      }
      if (!cleanPath.match(/\.(txt|md|csv|json)$/i)) {
        setModalError('File must end with a safe extension (.txt, .md, .csv, .json).');
        return;
      }
      setActiveModal(null);
      await handleAction(
        'create_text_file',
        { path: cleanPath, content: fileContentInput },
        `Create File (${cleanPath})`
      );
      setFilePathInput('');
      setFileContentInput('');
    } else if (activeModal === 'get_file_info') {
      const cleanPath = filePathInput.trim();
      if (!cleanPath) {
        setModalError('File path is required (e.g. notes.txt).');
        return;
      }
      setActiveModal(null);
      await handleAction('get_file_info', { path: cleanPath }, `Get Info (${cleanPath})`);
      setFilePathInput('');
    } else if (activeModal === 'open_file') {
      const cleanPath = filePathInput.trim();
      if (!cleanPath) {
        setModalError('File path is required (e.g. notes.txt, main.py).');
        return;
      }
      setActiveModal(null);
      await handleAction('open_file', { path: cleanPath }, `Open File (${cleanPath})`);
      setFilePathInput('');
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioFx.playClick();
    if (isMuted && newVol > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    audioFx.playClick();
    setIsMuted(!isMuted);
    setLastActionStatus(isMuted ? "Volume un-muted" : "Master volume muted");
  };

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Title */}
      <div className="flex items-center justify-between pb-1 border-b border-red-950/60">
        <div>
          <h2 className="font-mono text-base font-bold text-white tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-red-500" />
            IGRIS CONTROL CENTER
          </h2>
          <p className="font-mono text-[10px] text-slate-400">Safe Windows Laptop Control Subsystem</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800/60 text-[9px] font-mono text-red-400 font-bold">
          PHASE 6 READY
        </span>
      </div>

      {/* Execution Status Banner */}
      <div className="p-3 rounded-xl bg-black/60 border border-red-950/80 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          {isExecuting ? (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-slate-300">
            {stepMessage || lastActionStatus}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">DOUBLE-VALIDATED</span>
      </div>

      {/* 1. SYSTEM SECTION */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-red-400" />
          1. SYSTEM
        </span>
        <button
          onClick={() => handleAction('system_status', {}, 'Laptop Status')}
          disabled={isExecuting}
          className="p-3.5 rounded-xl bg-[#070b14]/90 hover:bg-red-950/40 border border-slate-800 hover:border-red-600 flex items-center justify-between transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-900 flex items-center justify-center text-red-400 shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-white">Laptop Status</div>
              <div className="font-mono text-[10px] text-slate-400">Query live CPU, RAM, Disk & Uptime</div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-black/60 border border-red-900/60 font-mono text-[10px] text-red-400 font-bold">
            CHECK
          </span>
        </button>
      </div>

      {/* 2. APPLICATIONS SECTION */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1 flex items-center gap-1.5">
          <Code className="w-3.5 h-3.5 text-cyan-400" />
          2. APPLICATIONS
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleAction('open_app', { app: 'chrome' }, 'Open Chrome')}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-red-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <Globe className="w-5 h-5 text-amber-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">Chrome</span>
            <span className="font-mono text-[9px] text-slate-500">Browser</span>
          </button>

          <button
            onClick={() => handleAction('open_app', { app: 'code' }, 'Open VS Code')}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-cyan-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <Code className="w-5 h-5 text-cyan-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">VS Code</span>
            <span className="font-mono text-[9px] text-slate-500">Editor</span>
          </button>

          <button
            onClick={() => handleAction('open_app', { app: 'notepad' }, 'Open Notepad')}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-slate-400 flex flex-col items-center gap-1.5 transition-all"
          >
            <FileText className="w-5 h-5 text-slate-300" />
            <span className="font-mono text-[11px] font-bold text-slate-200">Notepad</span>
            <span className="font-mono text-[9px] text-slate-500">Text Edit</span>
          </button>
        </div>
      </div>

      {/* 3. WORKSPACE SECTION */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1 flex items-center gap-1.5">
          <Folder className="w-3.5 h-3.5 text-amber-400" />
          3. WORKSPACE
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleAction('open_folder', { path: '' }, 'Open Workspace')}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-amber-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <FolderOpen className="w-5 h-5 text-amber-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">Open</span>
            <span className="font-mono text-[9px] text-slate-500">Explorer</span>
          </button>

          <button
            onClick={() => handleAction('list_folder', { path: '' }, 'List Workspace')}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-amber-400 flex flex-col items-center gap-1.5 transition-all"
          >
            <ListFilter className="w-5 h-5 text-cyan-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">List</span>
            <span className="font-mono text-[9px] text-slate-500">Directory</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setFolderNameInput('Projects');
              setActiveModal('create_folder');
            }}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-emerald-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <FolderPlus className="w-5 h-5 text-emerald-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">Create</span>
            <span className="font-mono text-[9px] text-slate-500">Folder</span>
          </button>
        </div>
      </div>

      {/* 4. FILES SECTION */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          4. FILES
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setModalError(null);
              setFilePathInput('notes.txt');
              setActiveModal('open_file');
            }}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-blue-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <PlayCircle className="w-5 h-5 text-blue-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">Open File</span>
            <span className="font-mono text-[9px] text-slate-500">Associated</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setFilePathInput('notes.txt');
              setActiveModal('get_file_info');
            }}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-cyan-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <FileSearch className="w-5 h-5 text-cyan-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">File Info</span>
            <span className="font-mono text-[9px] text-slate-500">Metadata</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setFilePathInput('notes.txt');
              setFileContentInput('Hello from IGRIS Control Center!');
              setActiveModal('create_text_file');
            }}
            disabled={isExecuting}
            className="p-3 rounded-xl bg-black/60 border border-slate-800 hover:border-emerald-500 flex flex-col items-center gap-1.5 transition-all"
          >
            <FilePlus className="w-5 h-5 text-emerald-400" />
            <span className="font-mono text-[11px] font-bold text-slate-200">Create Text</span>
            <span className="font-mono text-[9px] text-slate-500">Safe Exts</span>
          </button>
        </div>
      </div>

      {/* Audio & Display Controls */}
      <div className="p-4 rounded-2xl bg-[#070b14]/90 border border-red-950/60 flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              <span className="font-bold">MASTER VOLUME</span>
            </div>
            <span className="font-bold text-cyan-400">{isMuted ? 'MUTED' : `${volume}%`}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
          />
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={toggleMute}
              className={`py-1.5 px-2 rounded-lg font-mono text-[10px] border transition-all ${
                isMuted
                  ? 'bg-red-950/80 border-red-600 text-red-300'
                  : 'bg-black/40 border-slate-800 text-slate-400'
              }`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={() => handleVolumeChange(Math.max(0, volume - 10))}
              className="py-1.5 px-2 rounded-lg font-mono text-[10px] bg-black/40 border border-slate-800 text-slate-400 hover:text-white"
            >
              Vol -10%
            </button>
            <button
              onClick={() => handleVolumeChange(Math.min(100, volume + 10))}
              className="py-1.5 px-2 rounded-lg font-mono text-[10px] bg-black/40 border border-slate-800 text-slate-400 hover:text-white"
            >
              Vol +10%
            </button>
            <button
              onClick={() => handleVolumeChange(100)}
              className="py-1.5 px-2 rounded-lg font-mono text-[10px] bg-black/40 border border-slate-800 text-slate-400 hover:text-white"
            >
              Max 100%
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-900">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="font-bold">DISPLAY BRIGHTNESS</span>
            </div>
            <span className="font-bold text-amber-400">{brightness}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
          />
        </div>
      </div>

      {/* Interactive Modal for Parameterized Commands */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-[#070b14] border border-red-600/80 flex flex-col gap-3 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
            <div className="flex items-center justify-between border-b border-red-950 pb-2">
              <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                {activeModal === 'create_folder' && <FolderPlus className="w-4 h-4 text-emerald-400" />}
                {activeModal === 'create_text_file' && <FilePlus className="w-4 h-4 text-emerald-400" />}
                {activeModal === 'get_file_info' && <FileSearch className="w-4 h-4 text-cyan-400" />}
                {activeModal === 'open_file' && <PlayCircle className="w-4 h-4 text-blue-400" />}
                {activeModal === 'create_folder' && 'Create Workspace Folder'}
                {activeModal === 'create_text_file' && 'Create Text File'}
                {activeModal === 'get_file_info' && 'Inspect File Metadata'}
                {activeModal === 'open_file' && 'Open Existing File'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="font-mono text-[10px] text-slate-400">
              {activeModal === 'create_folder' && 'Enter a relative subpath inside workspace (e.g. Projects/MyCode).'}
              {activeModal === 'create_text_file' && 'Allowed extensions: .txt, .md, .csv, .json (max 10,000 characters).'}
              {activeModal === 'get_file_info' && 'Returns metadata only (filename, size, mod time) without leaking contents.'}
              {activeModal === 'open_file' && 'Opens existing safe file in its default Windows viewer.'}
            </p>

            <form onSubmit={handleModalSubmit} className="flex flex-col gap-3">
              {activeModal === 'create_folder' ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400">Folder Path:</label>
                  <input
                    type="text"
                    value={folderNameInput}
                    onChange={(e) => setFolderNameInput(e.target.value)}
                    placeholder="e.g. Projects/Phase6"
                    className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none focus:border-red-500"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400">File Path (relative):</label>
                  <input
                    type="text"
                    value={filePathInput}
                    onChange={(e) => setFilePathInput(e.target.value)}
                    placeholder="e.g. notes.txt or docs/README.md"
                    className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none focus:border-red-500"
                    autoFocus
                  />
                </div>
              )}

              {activeModal === 'create_text_file' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400">Content (optional):</label>
                  <textarea
                    rows={4}
                    value={fileContentInput}
                    onChange={(e) => setFileContentInput(e.target.value)}
                    placeholder="Enter file text content..."
                    className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none focus:border-red-500 resize-none"
                  />
                </div>
              )}

              {modalError && (
                <div className="text-[10px] font-mono text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExecuting}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 font-mono text-xs text-white font-bold transition-all"
                >
                  Confirm & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlScreen;
