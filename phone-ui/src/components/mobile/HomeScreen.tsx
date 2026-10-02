import React, { useState, useEffect } from 'react';
import {
  Lock,
  Moon,
  RotateCcw,
  Power,
  Laptop,
  HardDrive,
  Battery,
  Wifi,
  Bluetooth,
  ChevronRight,
  Sparkles,
  Camera,
  Volume2,
  Code,
  Globe,
  Radio,
  Clock,
  Zap
} from 'lucide-react';
import { SystemStatusData, HistoryItem } from '../../types/command';
import audioFx from '../../services/audioFx';
import useDeviceStatus from '../../services/useDeviceStatus';

interface HomeScreenProps {
  systemData: SystemStatusData | null;
  agentId: string;
  history: HistoryItem[];
  onExecuteCommand: (action: string, params: Record<string, any>, label: string) => Promise<void>;
  onOpenAskBlake: () => void;
  onNavigateTab: (tab: 'control' | 'apps' | 'files' | 'system') => void;
  onRequestConfirm: (action: string, params: Record<string, any>, label: string, desc: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  systemData,
  agentId,
  history,
  onExecuteCommand,
  onOpenAskBlake,
  onNavigateTab,
  onRequestConfirm
}) => {
  const deviceStatus = useDeviceStatus(systemData);
  const [activeCategory, setActiveCategory] = useState<'commands' | 'apps' | 'files' | 'system'>('commands');
  const [waveformBars, setWaveformBars] = useState<number[]>([35, 60, 25, 80, 95, 50, 75, 40, 85, 55, 30, 65]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaveformBars((prev) => prev.map(() => Math.floor(Math.random() * 65) + 20));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const handleSubTabClick = (tab: 'commands' | 'apps' | 'files' | 'system') => {
    audioFx.playTabSwitch();
    setActiveCategory(tab);
    if (tab !== 'commands') {
      onNavigateTab(tab);
    }
  };

  const handleQuickTap = (action: string, params: Record<string, any>, label: string, isSensitive = false) => {
    audioFx.playClick();
    if (isSensitive) {
      onRequestConfirm(action, params, label, `Are you sure you want to execute ${label} on ${agentId}?`);
    } else {
      onExecuteCommand(action, params, label);
    }
  };

  // Format history or fallback
  const displayHistory = history.length > 0 ? history.slice(0, 5) : [
    { id: '1', label: 'Open Chrome', timestamp: '2 min ago', commandId: 'c1', action: 'open_url', success: true },
    { id: '2', label: 'Take Screenshot', timestamp: '5 min ago', commandId: 'c2', action: 'open_app', success: true },
    { id: '3', label: 'Set Volume to 50%', timestamp: '12 min ago', commandId: 'c3', action: 'open_app', success: true },
    { id: '4', label: 'Open VS Code', timestamp: '18 min ago', commandId: 'c4', action: 'open_app', success: true },
    { id: '5', label: 'Lock PC', timestamp: '25 min ago', commandId: 'c5', action: 'open_app', success: true }
  ];

  return (
    <div className="flex flex-col gap-3.5 pb-28">
      {/* 0. Live Device Date & Time HUD */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#070b14]/90 border border-red-950/70 text-xs font-mono shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-slate-200 font-semibold truncate text-[11px] sm:text-xs">
            {deviceStatus.currentDate}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold shrink-0 ml-2">
          <Clock className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[11px] sm:text-xs">{deviceStatus.currentTime}</span>
        </div>
      </div>

      {/* 1. Quick Category Pills */}
      <div className="grid grid-cols-4 gap-2 pt-0.5">
        {[
          { id: 'commands', label: 'COMMANDS' },
          { id: 'apps', label: 'APPS' },
          { id: 'files', label: 'FILES' },
          { id: 'system', label: 'SYSTEM' }
        ].map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSubTabClick(tab.id as any)}
              className={`py-2 px-1 text-center font-mono text-[11px] font-bold rounded-lg transition-all tracking-wider ${
                isActive
                  ? 'bg-red-950/60 border border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-black/60 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. Blake Hero Card */}
      <div
        onClick={onOpenAskBlake}
        className="relative w-full h-44 rounded-2xl overflow-hidden border border-red-700/60 shadow-[0_0_25px_rgba(239,68,68,0.25)] group cursor-pointer"
        title="Tap to Ask Blake"
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{
            backgroundImage: `url('/blake_throne_hero.jpg')`,
            backgroundPosition: 'center 20%'
          }}
        />
        {/* Gradient overlays for cinematic depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />

        {/* Content on Blake Card */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded bg-black/60 border border-red-900/60 text-[9px] font-mono text-red-400 tracking-widest uppercase">
              AI COMMAND ASSISTANT
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ONLINE</span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-[10px] tracking-widest text-slate-300 uppercase">
              "A BETTER VERSION OF MYSELF"
            </span>
            <span className="font-serif text-2xl font-bold italic text-red-500 tracking-wider drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]">
              Blake
            </span>
          </div>
        </div>

        {/* Cyber corner marks */}
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-red-500 pointer-events-none" />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-red-500 pointer-events-none" />
      </div>

      {/* 3. Quick Commands */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3 bg-red-500 rounded-sm" />
            <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
              QUICK COMMANDS
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('control')}
            className="text-[11px] font-mono text-red-400 hover:text-red-300"
          >
            See All
          </button>
        </div>

        {/* 4x2 Grid of Actions */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1: Power & System */}
          <button
            onClick={() => handleQuickTap('open_app', { app: 'notepad' }, 'Lock PC')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-red-600/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-400 mb-1.5 group-hover:scale-110 transition-transform">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center">Lock PC</span>
          </button>

          <button
            onClick={() => handleQuickTap('system_status', {}, 'Sleep', true)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-cyan-500/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-900/50 flex items-center justify-center text-cyan-400 mb-1.5 group-hover:scale-110 transition-transform">
              <Moon className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center">Sleep</span>
          </button>

          <button
            onClick={() => handleQuickTap('system_status', {}, 'Restart', true)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-amber-500/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200 mb-1.5 group-hover:scale-110 transition-transform">
              <RotateCcw className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center">Restart</span>
          </button>

          <button
            onClick={() => handleQuickTap('system_status', {}, 'Shutdown', true)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-red-600/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-500 mb-1.5 group-hover:scale-110 transition-transform">
              <Power className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center">Shutdown</span>
          </button>

          {/* Row 2: Apps */}
          <button
            onClick={() => handleQuickTap('open_url', { url: 'https://google.com' }, 'Open Chrome')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-red-600/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-black/60 border border-slate-800 flex items-center justify-center text-amber-400 mb-1.5 group-hover:scale-110 transition-transform">
              <Globe className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center truncate w-full">Open Chrome</span>
          </button>

          <button
            onClick={() => handleQuickTap('open_app', { app: 'code' }, 'Open VS Code')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-cyan-500/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-950/40 border border-blue-900/50 flex items-center justify-center text-blue-400 mb-1.5 group-hover:scale-110 transition-transform">
              <Code className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center truncate w-full">Open VS Code</span>
          </button>

          <button
            onClick={() => handleQuickTap('open_url', { url: 'https://spotify.com' }, 'Open Spotify')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-emerald-500/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-950/40 border border-emerald-900/50 flex items-center justify-center text-emerald-400 mb-1.5 group-hover:scale-110 transition-transform">
              <Radio className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center truncate w-full">Open Spotify</span>
          </button>

          <button
            onClick={() => handleQuickTap('open_url', { url: 'https://youtube.com' }, 'Open YouTube')}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-red-600/80 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-400 mb-1.5 group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-semibold text-center truncate w-full">Open YouTube</span>
          </button>
        </div>
      </div>

      {/* 4. Device Status Card */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-3 bg-red-500 rounded-sm" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
            DEVICE STATUS
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#070b14]/90 border border-red-950/60 flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          {/* Top Laptop Connection Header */}
          <div
            onClick={() => onNavigateTab('system')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-black/60 border border-slate-800/80 cursor-pointer hover:border-red-500/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Laptop className="w-5 h-5 text-slate-300" />
              <span className="font-mono text-xs font-bold text-slate-100">
                {agentId || 'DESKTOP-7F3K'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-1" />
            </div>
          </div>

          {/* Grid row 1: CPU, RAM, Equalizer */}
          <div className="grid grid-cols-3 gap-2">
            {/* CPU */}
            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono">
                <Lock className="w-3 h-3 text-red-400" /> CPU
              </div>
              <div className="font-mono text-sm font-bold text-white mt-1">{deviceStatus.cpuPercent}%</div>
              <div className="w-full h-1 bg-slate-900 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, deviceStatus.cpuPercent))}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono">
                <HardDrive className="w-3 h-3 text-cyan-400" /> RAM
              </div>
              <div className="font-mono text-xs font-bold text-white mt-1 truncate" title={`${deviceStatus.ramUsed} / ${deviceStatus.ramTotal}`}>
                {deviceStatus.ramUsed} / {deviceStatus.ramTotal}
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, deviceStatus.ramPercent))}%` }}
                />
              </div>
            </div>

            {/* Equalizer Visualizer */}
            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex flex-col items-center justify-center">
              <div className="w-4 h-4 text-red-500 mb-1">🎯</div>
              <div className="flex items-end gap-0.5 h-6">
                {waveformBars.slice(0, 8).map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-gradient-to-t from-red-600 to-red-400 rounded-t transition-all duration-300"
                    style={{ height: `${h * 0.3}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Grid row 2: Storage & Battery */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400">Storage</div>
                <div className="font-bold text-white truncate" title={`${deviceStatus.diskUsed} / ${deviceStatus.diskTotal}`}>
                  {deviceStatus.diskUsed} / {deviceStatus.diskTotal}
                </div>
                <div className="w-full h-1 bg-slate-900 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, deviceStatus.diskPercent))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex items-center gap-2.5">
              {deviceStatus.battery.charging ? (
                <Zap className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <Battery className={`w-5 h-5 shrink-0 ${deviceStatus.battery.percent > 20 ? 'text-emerald-400' : 'text-rose-400'}`} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Battery</span>
                  <span className="text-[8px] text-slate-500 uppercase">{deviceStatus.battery.source}</span>
                </div>
                <div className={`font-bold ${deviceStatus.battery.percent > 20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {deviceStatus.battery.percent}%
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {deviceStatus.battery.charging ? 'Charging' : (deviceStatus.battery.source === 'device' ? 'On Battery' : 'Discharging')}
                </div>
              </div>
            </div>
          </div>

          {/* Grid row 3: Network & Uptime */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex items-center gap-2.5">
              <Wifi className={`w-4 h-4 ${deviceStatus.isOnline ? 'text-cyan-400' : 'text-slate-500'}`} />
              <div>
                <div className="text-[10px] text-slate-400">Network</div>
                <div className={`${deviceStatus.isOnline ? 'text-cyan-400' : 'text-rose-400'} font-semibold`}>
                  {deviceStatus.networkStatus}
                </div>
                <div className="text-[9px] text-slate-500">{deviceStatus.isOnline ? 'Low Latency' : 'Offline'}</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/50 border border-slate-900 flex items-center gap-2.5">
              <Bluetooth className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-400">Uptime</div>
                <div className="text-cyan-400 font-semibold">{deviceStatus.uptimeText}</div>
                <div className="text-[9px] text-slate-500">Live Telemetry</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Recent Commands */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-3 bg-red-500 rounded-sm" />
            <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
              RECENT COMMANDS
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('control')}
            className="text-[11px] font-mono text-red-400 hover:text-red-300"
          >
            View All
          </button>
        </div>

        <div className="p-2 rounded-2xl bg-[#070b14]/90 border border-red-950/60 flex flex-col gap-1.5">
          {displayHistory.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-slate-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                {idx === 0 && <Globe className="w-4 h-4 text-amber-400" />}
                {idx === 1 && <Camera className="w-4 h-4 text-cyan-400" />}
                {idx === 2 && <Volume2 className="w-4 h-4 text-slate-300" />}
                {idx === 3 && <Code className="w-4 h-4 text-blue-400" />}
                {idx >= 4 && <Lock className="w-4 h-4 text-red-400" />}
                <span className="font-mono text-xs font-semibold text-slate-200">{item.label}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{item.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
