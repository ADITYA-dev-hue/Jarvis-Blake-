import React, { useState } from 'react';
import {
  Search,
  Globe,
  Code,
  Radio,
  Folder,
  Terminal,
  MessageSquare,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { AppItem } from './types';
import audioFx from '../../services/audioFx';
import WindowsManagerCard from '../dashboard/WindowsManagerCard';

interface AppsScreenProps {
  onExecuteCommand: (action: string, params: Record<string, any>, label: string) => Promise<void>;
}

export const AppsScreen: React.FC<AppsScreenProps> = ({ onExecuteCommand }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'favorites'>('all');

  const [apps, setApps] = useState<AppItem[]>([
    {
      id: 'chrome',
      name: 'Google Chrome',
      category: 'Web Browser',
      icon: 'chrome',
      command: 'https://google.com',
      isUrl: true,
      status: 'running',
      cpu: '8.4%',
      ram: '1.42 GB',
      lastUsed: '2 min ago'
    },
    {
      id: 'vscode',
      name: 'Visual Studio Code',
      category: 'Developer IDE',
      icon: 'vscode',
      command: 'code',
      status: 'running',
      cpu: '4.1%',
      ram: '840 MB',
      lastUsed: '18 min ago'
    },
    {
      id: 'spotify',
      name: 'Spotify',
      category: 'Audio Player',
      icon: 'spotify',
      command: 'https://spotify.com',
      isUrl: true,
      status: 'running',
      cpu: '1.2%',
      ram: '235 MB',
      lastUsed: '35 min ago'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      category: 'Video Streaming',
      icon: 'youtube',
      command: 'https://youtube.com',
      isUrl: true,
      status: 'stopped',
      lastUsed: '2 hours ago'
    },
    {
      id: 'explorer',
      name: 'File Explorer',
      category: 'System Files',
      icon: 'explorer',
      command: 'explorer',
      status: 'running',
      cpu: '0.4%',
      ram: '68 MB',
      lastUsed: '1 hour ago'
    },
    {
      id: 'terminal',
      name: 'Windows Terminal',
      category: 'CLI Console',
      icon: 'terminal',
      command: 'calc',
      status: 'stopped',
      lastUsed: 'Yesterday'
    },
    {
      id: 'discord',
      name: 'Discord',
      category: 'Voice & Chat',
      icon: 'discord',
      command: 'https://discord.com',
      isUrl: true,
      status: 'stopped',
      lastUsed: 'Yesterday'
    },
    {
      id: 'notion',
      name: 'Notion',
      category: 'Productivity',
      icon: 'notion',
      command: 'https://notion.so',
      isUrl: true,
      status: 'stopped',
      lastUsed: '3 days ago'
    }
  ]);

  const handleLaunch = async (app: AppItem) => {
    audioFx.playClick();
    if (app.isUrl) {
      await onExecuteCommand('open_url', { url: app.command }, `Open ${app.name}`);
    } else {
      await onExecuteCommand('open_app', { app: app.command }, `Open ${app.name}`);
    }
    setApps((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, status: 'running', lastUsed: 'Just now' } : a))
    );
    audioFx.playSuccess();
  };

  const handleClose = (app: AppItem) => {
    audioFx.playClick();
    setApps((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, status: 'stopped' } : a))
    );
  };

  const filteredApps = apps.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          app.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'running') return matchesSearch && app.status === 'running';
    return matchesSearch;
  });

  const runningCount = apps.filter((a) => a.status === 'running').length;

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Title */}
      <div className="flex items-center justify-between pb-1 border-b border-red-950/60">
        <div>
          <h2 className="font-mono text-base font-bold text-white tracking-wider">
            LAPTOP APPLICATIONS
          </h2>
          <p className="font-mono text-[10px] text-slate-400">Process Management & Remote Dispatch</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-[9px] font-mono text-emerald-400 font-bold">
          {runningCount} RUNNING
        </span>
      </div>

      {/* Phase 10 Interactive Window Control */}
      <WindowsManagerCard onExecuteCommand={onExecuteCommand} isOnline={true} />

      {/* Search Bar */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/60 border border-red-950/80 focus-within:border-red-600 transition-colors">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search laptop apps..."
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white placeholder-slate-500"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white text-xs">
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { audioFx.playTabSwitch(); setFilter('all'); }}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-red-950/70 border border-red-600 text-white'
              : 'bg-black/40 border border-slate-900 text-slate-400'
          }`}
        >
          All ({apps.length})
        </button>
        <button
          onClick={() => { audioFx.playTabSwitch(); setFilter('running'); }}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
            filter === 'running'
              ? 'bg-red-950/70 border border-red-600 text-white'
              : 'bg-black/40 border border-slate-900 text-slate-400'
          }`}
        >
          Running ({runningCount})
        </button>
      </div>

      {/* App List */}
      <div className="flex flex-col gap-2.5">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className="p-3.5 rounded-2xl bg-[#070b14]/90 border border-slate-900 hover:border-red-950/80 flex flex-col gap-2 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/60 border border-slate-800 flex items-center justify-center text-lg shrink-0">
                  {app.icon === 'chrome' && <Globe className="w-5 h-5 text-amber-400" />}
                  {app.icon === 'vscode' && <Code className="w-5 h-5 text-blue-400" />}
                  {app.icon === 'spotify' && <Radio className="w-5 h-5 text-emerald-400" />}
                  {app.icon === 'youtube' && <Sparkles className="w-5 h-5 text-red-400" />}
                  {app.icon === 'explorer' && <Folder className="w-5 h-5 text-amber-300" />}
                  {app.icon === 'terminal' && <Terminal className="w-5 h-5 text-slate-300" />}
                  {app.icon === 'discord' && <MessageSquare className="w-5 h-5 text-indigo-400" />}
                  {app.icon === 'notion' && <BookOpen className="w-5 h-5 text-slate-200" />}
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-white flex items-center gap-2">
                    {app.name}
                    <span
                      className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold ${
                        app.status === 'running'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900'
                          : 'bg-slate-900 text-slate-500'
                      }`}
                    >
                      {app.status === 'running' ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">{app.category}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {app.status === 'running' && (
                  <button
                    onClick={() => handleClose(app)}
                    className="p-2 rounded-lg bg-red-950/30 hover:bg-red-950 border border-red-900/40 text-red-400 text-xs font-mono"
                    title="Terminate Process"
                  >
                    Kill
                  </button>
                )}
                <button
                  onClick={() => handleLaunch(app)}
                  className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-600 border border-red-700 text-red-300 hover:text-white font-mono text-xs font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                >
                  {app.status === 'running' ? 'Focus' : 'Launch'}
                </button>
              </div>
            </div>

            {/* Running Telemetry Bar if running */}
            {app.status === 'running' && (
              <div className="pt-2 border-t border-slate-900/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <span>CPU: <span className="text-cyan-400 font-bold">{app.cpu}</span></span>
                  <span>RAM: <span className="text-slate-200 font-bold">{app.ram}</span></span>
                </div>
                <span className="text-slate-500">Active {app.lastUsed}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppsScreen;
