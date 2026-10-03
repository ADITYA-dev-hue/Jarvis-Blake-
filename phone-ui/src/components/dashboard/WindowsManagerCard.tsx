import React, { useState, useEffect } from 'react';
import {
  AppWindow,
  Maximize2,
  Minimize2,
  RotateCcw,
  Eye,
  RefreshCw,
  Folder,
  Code2,
  Calculator,
  Compass,
  FileText,
  Palette,
  AlertCircle
} from 'lucide-react';
import { WindowItem } from '../../types/command';
import audioFx from '../../services/audioFx';

interface WindowsManagerCardProps {
  onExecuteCommand: (action: string, parameters: Record<string, any>, label: string) => Promise<any>;
  isOnline: boolean;
}

export const WindowsManagerCard: React.FC<WindowsManagerCardProps> = ({
  onExecuteCommand,
  isOnline
}) => {
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchWindows = async () => {
    if (!isOnline) return;
    setIsLoading(true);
    setStatusMsg(null);
    try {
      audioFx.playClick();
      const res = await onExecuteCommand('list_windows', {}, 'List Open Windows');
      if (res && res.data && Array.isArray(res.data.windows)) {
        setWindows(res.data.windows);
        setLastRefreshed(new Date());
      } else if (res && Array.isArray(res.windows)) {
        setWindows(res.windows);
        setLastRefreshed(new Date());
      }
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to list windows');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOnline) {
      fetchWindows();
    }
  }, [isOnline]);

  const handleWindowAction = async (action: 'focus_window' | 'minimize_window' | 'maximize_window' | 'restore_window', app: string) => {
    try {
      audioFx.playClick();
      const labelMap = {
        focus_window: `Focus ${app}`,
        minimize_window: `Minimize ${app}`,
        maximize_window: `Maximize ${app}`,
        restore_window: `Restore ${app}`
      };
      await onExecuteCommand(action, { app }, labelMap[action]);
      // Small delay then re-fetch
      setTimeout(() => {
        fetchWindows();
      }, 500);
    } catch (err: any) {
      setStatusMsg(err?.message || `Action failed`);
    }
  };

  const getAppIcon = (app: string) => {
    switch (app.toLowerCase()) {
      case 'chrome':
        return <Compass className="w-4 h-4 text-cyan-400" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-blue-400" />;
      case 'notepad':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'calculator':
        return <Calculator className="w-4 h-4 text-amber-400" />;
      case 'paint':
        return <Palette className="w-4 h-4 text-pink-400" />;
      case 'explorer':
        return <Folder className="w-4 h-4 text-yellow-400" />;
      default:
        return <AppWindow className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <AppWindow className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              WINDOW MANAGER
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                {windows.length} ACTIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Safe window control for approved desktop applications
            </p>
          </div>
        </div>
        <button
          onClick={fetchWindows}
          disabled={isLoading || !isOnline}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 disabled:opacity-50 transition-all flex items-center gap-1.5 text-xs"
          title="Refresh active windows"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {statusMsg && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {windows.length === 0 ? (
        <div className="py-6 px-4 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
          <AppWindow className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">No supported application windows detected</p>
          <p className="text-[10px] text-slate-500 mt-1">
            Supported apps: Chrome, VS Code, Notepad, Calculator, Paint, File Explorer
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {windows.map((w, idx) => (
            <div
              key={`${w.app}-${idx}`}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800">
                  {getAppIcon(w.app)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 capitalize truncate">
                    {w.app}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[220px]" title={w.title}>
                    {w.title || 'Active Window'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  onClick={() => handleWindowAction('focus_window', w.app)}
                  disabled={!isOnline}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/20 text-[11px] font-mono flex items-center gap-1 transition-colors"
                  title="Focus / Bring to front"
                >
                  <Eye className="w-3 h-3" />
                  <span>Focus</span>
                </button>
                <button
                  onClick={() => handleWindowAction('minimize_window', w.app)}
                  disabled={!isOnline}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleWindowAction('maximize_window', w.app)}
                  disabled={!isOnline}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition-colors"
                  title="Maximize"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleWindowAction('restore_window', w.app)}
                  disabled={!isOnline}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition-colors"
                  title="Restore"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lastRefreshed && (
        <div className="mt-3 text-[10px] text-slate-500 text-right font-mono">
          Updated: {lastRefreshed.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default WindowsManagerCard;
