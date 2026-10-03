import React, { useState, useEffect } from 'react';
import {
  Home,
  Sliders,
  Folder,
  Grid,
  Cpu,
  Zap,
  Shield,
  Activity,
  Settings as SettingsIcon,
  Mic,
  Send,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Battery,
  Wifi,
  Lock,
  Camera,
  Globe,
  Code,
  RefreshCw,
  FileText,
  Smartphone,
  Laptop,
  HardDrive,
  Heart,
  VolumeX,
  Moon,
  CheckCircle2,
  Copy,
  Clock,
  Sparkles,
  Search,
  Minus,
  Square,
  X,
  Music
} from 'lucide-react';
import { ConnectionState, AgentStatusState, AiStatusState, SystemStatusData, HistoryItem } from '../../types/command';
import audioFx from '../../services/audioFx';
import speechRecognition from '../../services/speechRecognition';
import useDeviceStatus from '../../services/useDeviceStatus';
import MultiViewSwitcher, { ViewMode } from '../MultiViewSwitcher';
import SystemDashboard from '../dashboard/SystemDashboard';
import WindowsManagerCard from '../dashboard/WindowsManagerCard';
import NowPlayingCard from '../dashboard/NowPlayingCard';
import VoiceSettings from '../VoiceSettings';

interface DesktopDashboardProps {
  connectionState: ConnectionState;
  agentStatus: AgentStatusState;
  agentId: string;
  aiStatus: AiStatusState;
  systemData: SystemStatusData | null;
  history: HistoryItem[];
  onExecuteCommand: (action: string, parameters: Record<string, any>, label: string) => Promise<void>;
  onSendAiCommand: (text: string, source: 'text' | 'voice') => Promise<any>;
  onSwitchToMobile?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  isExecuting: boolean;
  stepMessage: string | null;
}

type TabType = 'home' | 'control' | 'apps' | 'files' | 'system' | 'automation' | 'security' | 'activity' | 'settings';

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  connectionState,
  agentStatus,
  agentId,
  aiStatus,
  systemData,
  history,
  onExecuteCommand,
  onSendAiCommand,
  onSwitchToMobile,
  viewMode,
  onViewModeChange,
  isExecuting,
  stepMessage
}) => {
  const deviceStatus = useDeviceStatus(systemData);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [inputCommand, setInputCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Media Player State
  const [isPlaying, setIsPlaying] = useState(true);
  const [mediaProgress, setMediaProgress] = useState(85);
  const [isLiked, setIsLiked] = useState(true);

  // Live Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Control tab sliders
  const [masterVolume, setMasterVolume] = useState(65);
  const [brightness, setBrightness] = useState(85);
  const [clipboardSynced, setClipboardSynced] = useState(false);

  // Blake AI responses state
  const [aiMessage, setAiMessage] = useState<string>(
    "Systems synchronized. Speak or command, and I shall enforce your will."
  );

  // New folder creation state for Files tab
  const [newFolderName, setNewFolderName] = useState('');
  const [createdFolders, setCreatedFolders] = useState<string[]>([
    'workspace/projects',
    'workspace/telemetry',
    'workspace/secure_vault',
    'workspace/logs'
  ]);

  // Audio equalizer bars animation
  const [eqHeights, setEqHeights] = useState<number[]>([40, 65, 30, 85, 95, 55, 75, 45, 90, 60, 35, 70, 80, 50, 60, 75]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setEqHeights((prev) =>
        prev.map(() => Math.floor(Math.random() * 70) + 25)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setMediaProgress((p) => (p >= 228 ? 0 : p + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    document.title = `IGRIS — BLAKE | ${tabName}`;
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    if (soundEnabled) audioFx.playTabSwitch();
    setActiveTab(tab);
  };

  const handleSendPrompt = async () => {
    if (!inputCommand.trim() || isExecuting) return;
    const prompt = inputCommand.trim();
    setInputCommand('');
    if (soundEnabled) audioFx.playClick();
    setAiMessage(`Analyzing: "${prompt}"... Executing protocols.`);
    const res = await onSendAiCommand(prompt, 'text');
    if (res?.message) {
      setAiMessage(res.message);
    }
    if (soundEnabled) audioFx.playSuccess();
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      speechRecognition.stop();
      setIsListening(false);
    } else {
      if (soundEnabled) audioFx.playMicPulse();
      setIsListening(true);
      speechRecognition.setCallbacks({
        onFinalResult: (transcript: string) => {
          setInputCommand(transcript);
          setIsListening(false);
          onSendAiCommand(transcript, 'voice');
          if (soundEnabled) audioFx.playSuccess();
        },
        onError: () => {
          setIsListening(false);
          if (soundEnabled) audioFx.playAlert();
        },
        onEnd: () => {
          setIsListening(false);
        }
      });
      speechRecognition.start();
    }
  };

  const handleQuickAction = async (action: string, params: Record<string, any>, label: string) => {
    if (soundEnabled) audioFx.playClick();
    setAiMessage(`Direct command invoked: ${label}`);
    await onExecuteCommand(action, params, label);
    if (soundEnabled) audioFx.playSuccess();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderPath = `workspace/${newFolderName.trim()}`;
    await handleQuickAction('create_folder', { path: folderPath }, `Create Folder: ${folderPath}`);
    setCreatedFolders((prev) => [...prev, folderPath]);
    setNewFolderName('');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Safe hardware values derived from live device & system telemetry
  const cpuVal = deviceStatus.cpuPercent;
  const ramVal = deviceStatus.ramPercent;
  const diskVal = deviceStatus.diskPercent;
  const ramTotal = deviceStatus.ramTotal;
  const ramUsed = deviceStatus.ramUsed;
  const diskTotal = deviceStatus.diskTotal;
  const diskUsed = deviceStatus.diskUsed;

  return (
    <div className="min-h-screen w-full bg-[#03060c] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative cyber-grid-bg">
      {/* Background Ambience & Lighting */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* ========================================================================= */}
      {/* 1. TOP BAR / WINDOWS APPLICATION HEADER                                  */}
      {/* ========================================================================= */}
      <header className="h-12 w-full bg-[#050913]/90 backdrop-blur-md border-b border-red-950/60 px-4 flex items-center justify-between text-xs z-50">
        {/* Brand & Left Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-red-900/40">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] bg-black shrink-0">
              <img src="/favicon-32x32.png" alt="IGRIS" className="w-full h-full object-cover" />
            </div>
            <span className="font-mono font-bold tracking-widest text-slate-100 uppercase text-sm glow-text-red">
              IGRIS
            </span>
            <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-800/50 px-1.5 py-0.2 rounded font-mono font-semibold">
              BLAKE OS v3.2
            </span>
          </div>

          {/* Device & Connection Badges */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-slate-800 text-slate-300">
              <Laptop className="w-3.5 h-3.5 text-red-400" />
              <span className="font-mono text-[11px] font-semibold">{agentId}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${agentStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-slate-800 text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono text-[11px]">
                PHONE: {connectionState === 'CONNECTED' ? 'CONNECTED' : connectionState}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-slate-800 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[11px]">PORT 3000 • SECURE E2E</span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-slate-800 text-slate-400">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-[10px]">12ms PING</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-950/40 border border-red-900/50 text-red-400 font-mono text-[10px]">
              <span>STATUS:</span>
              <span className="font-bold text-white">{aiStatus}</span>
            </div>
          </div>
        </div>

        {/* Center Live Execution Banner */}
        {isExecuting && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-950/90 border border-red-500/80 text-red-200 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            <RefreshCw className="w-3 h-3 animate-spin text-red-400" />
            <span className="font-mono text-[11px] font-semibold tracking-wide">
              {stepMessage || 'EXECUTING NEURAL PROTOCOL...'}
            </span>
          </div>
        )}

        {/* Right Status & Windows Controls */}
        <div className="flex items-center gap-3">
          {/* Sound FX Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              audioFx.setEnabled(!soundEnabled);
            }}
            title={soundEnabled ? "Sound FX: ON" : "Sound FX: MUTED"}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Multi-View Mode Switcher */}
          {onViewModeChange ? (
            <MultiViewSwitcher
              currentMode={viewMode || 'desktop'}
              onModeChange={onViewModeChange}
            />
          ) : (
            onSwitchToMobile && (
              <button
                onClick={onSwitchToMobile}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/80 border border-red-700/60 text-red-300 hover:text-white font-mono text-[11px] transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                title="Switch to Mobile Controller View"
              >
                <Smartphone className="w-3.5 h-3.5 text-red-400" />
                <span>PHONE UI</span>
              </button>
            )
          )}

          {/* Weather Widget */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 font-mono text-[11px] px-2 border-r border-slate-800">
            <span>☁ 22°C</span>
            <span className="text-slate-500">•</span>
            <span>Phagwara, IN</span>
          </div>

          {/* Live Date and Time */}
          <div className="flex items-center gap-1.5 font-mono text-slate-200 text-[11px] px-1">
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Windows-style Title Bar Controls */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 rounded transition-colors">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 rounded transition-colors">
              <Square className="w-3 h-3" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-red-600 hover:text-white rounded transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN BODY: LEFT SIDEBAR + WORKSPACE HUD                               */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* ======================================================================= */}
        {/* LEFT CYBER SIDEBAR                                                      */}
        {/* ======================================================================= */}
        <aside className="w-64 bg-[#040813]/95 border-r border-red-950/50 flex flex-col justify-between p-4 z-20 backdrop-blur-md">
          {/* Top Brand Banner */}
          <div>
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-red-950/70">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600/30 to-black border border-red-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)] overflow-hidden p-0.5">
                <img
                  src="/favicon-48x48.png"
                  alt="IGRIS Blake Emblem"
                  className="w-full h-full object-contain rounded-md"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold tracking-widest text-base text-slate-100 glow-text-red">
                    IGRIS
                  </span>
                </div>
                <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">
                  PERSONAL CONTROL SYSTEM
                </span>
                <span className="text-[12px] font-mono font-bold tracking-wider text-red-500 glow-text-red">
                  B L A K E
                </span>
              </div>
            </div>

            <div className="px-2 py-1 mb-4 rounded bg-red-950/30 border border-red-900/40 text-[10px] font-mono text-red-400 italic text-center">
              "DISCIPLINE CREATES FREEDOM"
            </div>

            {/* Navigation Tabs */}
            <nav className="flex flex-col gap-1.5">
              {[
                { id: 'home', label: 'Home', icon: Home },
                { id: 'control', label: 'Control', icon: Sliders },
                { id: 'apps', label: 'Apps', icon: Grid },
                { id: 'files', label: 'Files', icon: Folder },
                { id: 'system', label: 'System', icon: Cpu },
                { id: 'automation', label: 'Automation', icon: Zap },
                { id: 'security', label: 'Security', icon: Shield },
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'settings', label: 'Settings', icon: SettingsIcon }
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id as TabType)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-mono transition-all group ${
                      isActive
                        ? 'bg-red-950/60 border border-red-500/80 text-white shadow-[0_0_18px_rgba(239,68,68,0.4)] glow-border-red font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 hover:border hover:border-red-950/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent
                        className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-slate-500'
                        }`}
                      />
                      <span className="tracking-wide">{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_6px_#ef4444]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Quote & Blake Signature */}
          <div className="pt-4 border-t border-red-950/60 flex flex-col gap-2">
            <div className="p-2.5 rounded-lg bg-black/60 border border-red-950/60 text-[10px] font-mono text-slate-400">
              <span className="text-red-400 font-bold block mb-1">“SAME SOUL NEW HEIGHTS”</span>
              <span className="text-slate-500 block text-right">— BLAKE</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>SECURITY: SECURE</span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
          </div>
        </aside>

        {/* ======================================================================= */}
        {/* CENTER + RIGHT WORKSPACE CONTENT                                        */}
        {/* ======================================================================= */}
        <main className="flex-1 flex flex-col h-[calc(100vh-3rem)] overflow-y-auto overflow-x-hidden relative">
          {/* TAB 1: HOME (THE CINEMATIC BLAKE COMMAND CENTER) */}
          {activeTab === 'home' && (
            <div className="flex-1 p-5 flex flex-col gap-5">
              {/* Top Row: Hero Section with Blake and HUD Telemetry */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
                {/* Left Mini HUD Widgets (Col 1-3 on XL) */}
                <div className="xl:col-span-3 flex flex-col gap-4 justify-between">
                  {/* Circular Date/Time HUD Card */}
                  <div className="cyber-glass-panel rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="w-36 h-36 rounded-full border-2 border-red-600/40 relative flex flex-col items-center justify-center p-3 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                      {/* Rotating Outer Reticle */}
                      <div className="absolute inset-0 rounded-full border border-dashed border-red-500/60 animate-spin-slow pointer-events-none" />
                      <div className="absolute -inset-2 rounded-full border border-dotted border-cyan-500/40 animate-spin-reverse-slow pointer-events-none" />

                      <span className="text-[11px] font-mono text-red-400 tracking-wider">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                        {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
                      </span>
                      <span className="text-3xl font-extrabold text-white font-mono tracking-tight my-0.5 glow-text-red">
                        {currentTime.getDate() < 10 ? `0${currentTime.getDate()}` : currentTime.getDate()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest">
                        {currentTime.toLocaleDateString('en-US', { month: 'long' })}
                      </span>
                    </div>

                    {/* Operational Pillars */}
                    <div className="w-full grid grid-cols-3 gap-1 mt-4 text-[10px] font-mono text-center">
                      <div className="bg-red-950/40 border border-red-900/50 py-1 rounded text-red-400">
                        ▼ FOCUS
                      </div>
                      <div className="bg-red-950/40 border border-red-900/50 py-1 rounded text-red-400">
                        ▶ EXECUTE
                      </div>
                      <div className="bg-red-950/40 border border-red-900/50 py-1 rounded text-red-400">
                        ◆ EVOLVE
                      </div>
                    </div>
                  </div>

                  {/* System Status Gauges */}
                  <div className="cyber-glass-panel rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-red-950/60">
                      <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
                        SYSTEM STATUS
                      </span>
                      <button
                        onClick={() => handleQuickAction('system_status', {}, 'System Refresh')}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Refresh Hardware Telemetry"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 3 Circular Metric Gauges */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {/* CPU Gauge */}
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-2 border-red-500/60 flex flex-col items-center justify-center bg-black/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                          <span className="text-[10px] font-mono text-slate-400">CPU</span>
                          <span className="text-sm font-mono font-bold text-white">
                            {cpuVal}%
                          </span>
                        </div>
                      </div>

                      {/* RAM Gauge */}
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/60 flex flex-col items-center justify-center bg-black/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                          <span className="text-[10px] font-mono text-slate-400">RAM</span>
                          <span className="text-sm font-mono font-bold text-white">
                            {ramVal}%
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 mt-1">{ramUsed} / {ramTotal}</span>
                      </div>

                      {/* Storage Gauge */}
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-2 border-red-500/60 flex flex-col items-center justify-center bg-black/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                          <span className="text-[10px] font-mono text-slate-400">STORAGE</span>
                          <span className="text-sm font-mono font-bold text-white">
                            {diskVal}%
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 mt-1">{diskUsed} / {diskTotal}</span>
                      </div>
                    </div>

                    {/* Network & Battery sub-rows */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Wifi className={`w-3 h-3 ${deviceStatus.isOnline ? 'text-cyan-400' : 'text-slate-500'}`} /> NETWORK
                        </span>
                        <span className="text-slate-200">
                          {deviceStatus.isOnline ? 'Connected • Live' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Battery className={`w-3.5 h-3.5 ${deviceStatus.battery.percent > 20 ? 'text-emerald-400' : 'text-rose-400'}`} /> BATTERY
                        </span>
                        <span className={`font-semibold ${deviceStatus.battery.percent > 20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {deviceStatus.battery.levelText}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center Hero: Blake Portrait + Holographic HUD (Col 4-9 on XL) */}
                <div className="xl:col-span-6 cyber-glass-panel rounded-2xl relative min-h-[460px] flex flex-col items-center justify-between overflow-hidden p-6 border border-red-700/50 shadow-[0_0_35px_rgba(239,68,68,0.25)]">
                  {/* Blake Image Background */}
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95 transition-all duration-700 hover:scale-[1.02]"
                    style={{
                      backgroundImage: `url('/blake_throne_hero.jpg')`,
                      backgroundPosition: 'center 20%'
                    }}
                  />

                  {/* Dark Vignette and Gradient Overlay to allow text & HUD controls on top */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#03060c] via-black/40 to-black/60 pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(3,6,12,0.85)_100%)] pointer-events-none" />

                  {/* Top Overlay Headers */}
                  <div className="w-full flex items-start justify-between z-10">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-red-400 tracking-widest font-semibold uppercase">
                        AI COMMAND ASSISTANT
                      </span>
                      <h1 className="font-mono text-3xl font-black tracking-widest text-white glow-text-red">
                        B L A K E
                      </h1>
                      <span className="text-[11px] font-mono text-slate-300 italic tracking-wider mt-0.5">
                        “DISCIPLINE CREATES FREEDOM”
                      </span>
                    </div>

                    {/* Right System Indicators */}
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2 px-3 py-1 bg-black/70 border border-emerald-500/60 rounded-full text-emerald-400 font-mono text-[11px] shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>SYSTEM ONLINE</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 bg-black/60 px-2 py-0.5 rounded border border-slate-800">
                        ANALYZE • CONTROL • EXECUTE
                      </div>
                    </div>
                  </div>

                  {/* Central Holographic Rotating Rings & Core (Aligned over chest/center) */}
                  <div className="relative my-auto z-10 flex flex-col items-center justify-center">
                    {/* Outer Rotating Cyber Reticle */}
                    <div className="w-48 h-48 rounded-full border border-red-500/40 relative flex items-center justify-center shadow-[0_0_35px_rgba(239,68,68,0.45)]">
                      {/* Ring 1: Clockwise */}
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-500/70 animate-spin-medium" />
                      {/* Ring 2: Counter-Clockwise */}
                      <div className="absolute -inset-3 rounded-full border border-dotted border-cyan-400/80 animate-spin-reverse-slow" />
                      {/* Ring 3: Fast Inner Tick Ring */}
                      <div className="absolute inset-3 rounded-full border border-red-400/30 animate-spin-slow" />

                      {/* Glowing Core Center with Diamond Star & Official Igris Blake Emblem */}
                      <div className="w-24 h-24 rounded-full bg-black/90 border-2 border-red-500/80 flex flex-col items-center justify-center text-center backdrop-blur-md shadow-[0_0_25px_rgba(239,68,68,0.7)] group cursor-pointer hover:border-cyan-400 transition-colors overflow-hidden p-1.5">
                        <img
                          src="/igris_blake_round.png"
                          alt="IGRIS Core Emblem"
                          className="w-full h-full object-contain rounded-full shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                        />
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <span className="text-sm font-mono font-bold tracking-widest text-slate-100 glow-text-red block">
                        BLAKE
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 tracking-wider">
                        YOUR AI ASSISTANT
                      </span>
                    </div>
                  </div>

                  {/* Bottom Core Status Bullets */}
                  <div className="w-full flex items-end justify-between z-10 pt-4">
                    <div className="flex flex-col gap-1 text-[11px] font-mono text-slate-200 bg-black/70 p-2.5 rounded-lg border border-red-950/80">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>VOICE : ACTIVE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>CONTROL : READY</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>AUTOMATION : ONLINE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>SECURITY : SECURE</span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] font-mono text-slate-400 bg-black/60 p-2 rounded border border-slate-800">
                      <span className="text-red-400 font-semibold block">HOLOGRAPHIC CORE</span>
                      <span>FREQ: 142.8 GHz</span>
                    </div>
                  </div>
                </div>

                {/* Right Mini HUD Widgets (Col 10-12 on XL): Active Apps & Recent Commands */}
                <div className="xl:col-span-3 flex flex-col gap-4 justify-between">
                  {/* Active Applications Card */}
                  <div className="cyber-glass-panel rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-red-950/60">
                      <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
                        ACTIVE APPS
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">4 RUNNING</span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {[
                        { name: 'Chrome', percent: 32, color: 'bg-red-500' },
                        { name: 'VS Code', percent: 18, color: 'bg-cyan-500' },
                        { name: 'Spotify', percent: 6, color: 'bg-emerald-500' },
                        { name: 'Notion', percent: 4, color: 'bg-amber-500' },
                        { name: 'Others', percent: 12, color: 'bg-slate-500' }
                      ].map((app, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-300">{app.name}</span>
                            <span className="text-slate-400">{app.percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${app.color} rounded-full transition-all duration-500`}
                              style={{ width: `${app.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Commands Card */}
                  <div className="cyber-glass-panel rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-red-950/60">
                      <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
                        RECENT COMMANDS
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">SAFE VERIFIED</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {[
                        { label: 'Open Chrome', time: '2 min ago', status: 'EXECUTED' },
                        { label: 'Take Screenshot', time: '5 min ago', status: 'APPROVED' },
                        { label: 'Set Volume to 50%', time: '12 min ago', status: 'EXECUTED' },
                        { label: 'Open VS Code', time: '18 min ago', status: 'APPROVED' },
                        { label: 'Lock PC', time: '25 min ago', status: 'EXECUTED' }
                      ].map((cmd, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-900 text-xs font-mono"
                        >
                          <div className="flex flex-col">
                            <span className="text-slate-200 font-semibold">{cmd.label}</span>
                            <span className="text-[10px] text-slate-500">{cmd.time}</span>
                          </div>
                          <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded font-mono">
                            {cmd.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Media Player + Ask Blake Command Console */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch mt-auto">
                {/* Media Player Widget (Col 1-4 on XL) */}
                <div className="xl:col-span-4 cyber-glass-panel rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-red-950/60 text-[10px] font-mono text-slate-400">
                    <span className="tracking-widest uppercase">NOW PLAYING</span>
                    <span className="text-red-400 flex items-center gap-1">
                      <Music className="w-3 h-3" /> AUDIO CORE
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 my-2">
                    <div className="w-14 h-14 rounded-lg bg-cover bg-center border border-red-600/50 shadow-[0_0_12px_rgba(239,68,68,0.3)] overflow-hidden shrink-0 relative">
                      <img src="/blake_hero.jpg" alt="Void - Blake" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-red-900/20" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-mono text-sm font-bold text-white truncate">Void</h4>
                        <button
                          onClick={() => setIsLiked(!isLiked)}
                          className={`text-xs ${isLiked ? 'text-red-400' : 'text-slate-600'}`}
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                      <span className="font-mono text-xs text-red-400 block truncate">Blake</span>
                      
                      {/* Audio Equalizer Bars */}
                      <div className="flex items-end gap-0.5 h-4 mt-1.5">
                        {eqHeights.slice(0, 14).map((h, idx) => (
                          <div
                            key={idx}
                            className="w-1 bg-gradient-to-t from-red-600 to-cyan-400 rounded-t transition-all duration-300"
                            style={{ height: `${isPlaying ? h : 15}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Progress & Controls */}
                  <div className="flex flex-col gap-1.5">
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden cursor-pointer">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-cyan-400 rounded-full transition-all"
                        style={{ width: `${(mediaProgress / 228) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>{formatTime(mediaProgress)}</span>
                      <span>3:48</span>
                    </div>

                    <div className="flex items-center justify-center gap-4 pt-1">
                      <button
                        onClick={() => {
                          setMediaProgress((p) => Math.max(0, p - 15));
                          if (soundEnabled) audioFx.playClick();
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsPlaying(!isPlaying);
                          if (soundEnabled) audioFx.playClick();
                        }}
                        className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.6)] transition-all"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <button
                        onClick={() => {
                          setMediaProgress((p) => Math.min(228, p + 15));
                          if (soundEnabled) audioFx.playClick();
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ask Blake Console & Quick Action Pills (Col 5-12 on XL) */}
                <div className="xl:col-span-8 cyber-glass-panel rounded-xl p-4 flex flex-col justify-between gap-3 border border-red-700/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  {/* Blake AI Response Telemetry Bubble */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/60 border border-red-950/80">
                    <div className="w-7 h-7 rounded-full bg-red-950 border border-red-500/80 flex items-center justify-center text-red-400 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 text-xs font-mono text-slate-300">
                      <span className="text-red-400 font-bold mr-2">BLAKE:</span>
                      <span className="italic">{aiMessage}</span>
                    </div>
                  </div>

                  {/* Ask Blake Input Bar */}
                  <div className="flex items-center gap-3 p-1.5 rounded-xl bg-black/80 border border-red-600/60 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    {/* Glowing Red Microphone Button */}
                    <button
                      onClick={handleVoiceToggle}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        isListening
                          ? 'bg-red-600 text-white animate-pulse shadow-[0_0_20px_#ef4444]'
                          : 'bg-red-950/60 text-red-400 hover:bg-red-900/60 hover:text-white border border-red-700/60'
                      }`}
                      title={isListening ? "Listening... Click to stop" : "Speak to Blake"}
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    {/* Input Field */}
                    <input
                      type="text"
                      value={inputCommand}
                      onChange={(e) => setInputCommand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                      placeholder="Ask Blake... (e.g. 'Open GitHub', 'Check laptop status', 'Lock PC')"
                      className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-slate-100 placeholder-slate-500 px-2"
                      disabled={isExecuting}
                    />

                    {/* Live Waveform Indicator */}
                    <div className="hidden sm:flex items-center gap-1 px-2 h-6 border-r border-slate-800">
                      {eqHeights.slice(0, 8).map((h, idx) => (
                        <div
                          key={idx}
                          className="w-0.5 bg-red-500/80 rounded transition-all duration-200"
                          style={{ height: `${h * 0.25}px` }}
                        />
                      ))}
                    </div>

                    {/* Send Button */}
                    <button
                      onClick={handleSendPrompt}
                      disabled={!inputCommand.trim() || isExecuting}
                      className="w-10 h-10 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>

                  {/* Quick Command Action Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { action: 'open_url', params: { url: 'https://github.com' }, label: 'Open Browser', icon: Globe },
                      { action: 'open_app', params: { app: 'code' }, label: 'Open VS Code', icon: Code },
                      { action: 'open_app', params: { app: 'notepad' }, label: 'Open Notepad', icon: FileText },
                      { action: 'system_status', params: {}, label: 'System Status', icon: Activity },
                      { action: 'open_url', params: { url: 'https://google.com' }, label: 'Search Google', icon: Search },
                      { action: 'open_app', params: { app: 'calc' }, label: 'Calculator', icon: HardDrive }
                    ].map((item, i) => {
                      const ItemIcon = item.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => handleQuickAction(item.action, item.params, item.label)}
                          disabled={isExecuting || agentStatus === 'offline'}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-black/60 hover:bg-red-950/60 border border-slate-800 hover:border-red-600/70 text-slate-300 hover:text-white text-xs font-mono transition-all group disabled:opacity-40"
                        >
                          <ItemIcon className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1 pt-1 border-t border-red-950/50">
                    <span>CONTROL × AUTOMATE × OPTIMIZE × EVOLVE</span>
                    <span>ENCRYPTED SOCKET SHA-256</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTROL */}
          {activeTab === 'control' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">HARDWARE CONTROL CENTER</h2>
                  <p className="font-mono text-xs text-slate-400">Direct laptop system controls & telemetry overrides</p>
                </div>
                <span className="px-2.5 py-1 bg-red-950/80 text-red-400 border border-red-800/60 rounded font-mono text-xs">
                  ADMIN ELEVATED
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Master Volume Slider */}
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-cyan-400" /> MASTER VOLUME
                    </span>
                    <span className="font-mono text-sm font-bold text-cyan-400">{masterVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => {
                      setMasterVolume(Number(e.target.value));
                      if (soundEnabled) audioFx.playClick();
                    }}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-xs font-mono">
                    <button
                      onClick={() => setMasterVolume(0)}
                      className="px-3 py-1 bg-slate-900 border border-slate-800 rounded hover:text-white"
                    >
                      Mute (0%)
                    </button>
                    <button
                      onClick={() => setMasterVolume(50)}
                      className="px-3 py-1 bg-slate-900 border border-slate-800 rounded hover:text-white"
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setMasterVolume(100)}
                      className="px-3 py-1 bg-slate-900 border border-slate-800 rounded hover:text-white"
                    >
                      Max (100%)
                    </button>
                  </div>
                </div>

                {/* Display Brightness Slider */}
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" /> DISPLAY BRIGHTNESS
                    </span>
                    <span className="font-mono text-sm font-bold text-amber-400">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={brightness}
                    onChange={(e) => {
                      setBrightness(Number(e.target.value));
                      if (soundEnabled) audioFx.playClick();
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Power Saver (25%)</span>
                    <span>Balanced (60%)</span>
                    <span>Max Nits (100%)</span>
                  </div>
                </div>
              </div>

              {/* Power & Security Quick Actions */}
              <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-4">
                <span className="font-mono text-sm font-semibold text-slate-200">DEVICE POWER & SECURITY ACTIONS</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => handleQuickAction('open_app', { app: 'notepad' }, 'Lock Windows Screen')}
                    className="p-4 rounded-lg bg-black/60 border border-slate-800 hover:border-red-600/80 flex flex-col items-center gap-2 text-center group transition-all"
                  >
                    <Lock className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-xs font-bold text-white">Lock PC</span>
                    <span className="text-[10px] font-mono text-slate-500">Require PIN/Face</span>
                  </button>

                  <button
                    onClick={() => handleQuickAction('open_app', { app: 'calc' }, 'Capture Screenshot')}
                    className="p-4 rounded-lg bg-black/60 border border-slate-800 hover:border-cyan-500/80 flex flex-col items-center gap-2 text-center group transition-all"
                  >
                    <Camera className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-xs font-bold text-white">Screenshot</span>
                    <span className="text-[10px] font-mono text-slate-500">Save to Pictures</span>
                  </button>

                  <button
                    onClick={() => {
                      setClipboardSynced(true);
                      setTimeout(() => setClipboardSynced(false), 2000);
                      if (soundEnabled) audioFx.playSuccess();
                    }}
                    className="p-4 rounded-lg bg-black/60 border border-slate-800 hover:border-emerald-500/80 flex flex-col items-center gap-2 text-center group transition-all"
                  >
                    <Copy className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-xs font-bold text-white">Sync Clipboard</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {clipboardSynced ? "Synced!" : "Phone ↔ Laptop"}
                    </span>
                  </button>

                  <button
                    onClick={() => handleQuickAction('system_status', {}, 'Query Battery Health')}
                    className="p-4 rounded-lg bg-black/60 border border-slate-800 hover:border-amber-500/80 flex flex-col items-center gap-2 text-center group transition-all"
                  >
                    <Moon className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-xs font-bold text-white">Sleep Mode</span>
                    <span className="text-[10px] font-mono text-slate-500">Standby RAM State</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPS */}
          {activeTab === 'apps' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">APPLICATION LAUNCHER & PROCESSES</h2>
                  <p className="font-mono text-xs text-slate-400">Launch authorized desktop apps and manage active processes</p>
                </div>
                <button
                  onClick={() => handleQuickAction('system_status', {}, 'Refresh Process List')}
                  className="px-3 py-1 bg-red-950/60 border border-red-700/60 text-red-300 rounded font-mono text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Phase 10 Interactive Window Control & Desktop Media Monitor */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WindowsManagerCard onExecuteCommand={onExecuteCommand} isOnline={deviceStatus.isOnline} />
                <NowPlayingCard isOnline={deviceStatus.isOnline} />
              </div>

              {/* Quick Launch Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Visual Studio Code', command: 'code', icon: Code, desc: 'IDE & Code Editor' },
                  { name: 'Google Chrome', command: 'https://google.com', isUrl: true, icon: Globe, desc: 'Web Browser' },
                  { name: 'Windows Notepad', command: 'notepad', icon: FileText, desc: 'Text Editor' },
                  { name: 'Windows Calculator', command: 'calc', icon: HardDrive, desc: 'Math Utilities' }
                ].map((app, idx) => {
                  const AppIcon = app.icon;
                  return (
                    <div
                      key={idx}
                      className="cyber-glass-panel rounded-xl p-4 flex flex-col justify-between gap-3 group hover:border-red-600 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                          <AppIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900">
                          WHITELISTED
                        </span>
                      </div>
                      <div>
                        <h4 className="font-mono text-sm font-bold text-white">{app.name}</h4>
                        <p className="font-mono text-xs text-slate-400">{app.desc}</p>
                      </div>
                      <button
                        onClick={() =>
                          app.isUrl
                            ? handleQuickAction('open_url', { url: app.command }, `Launch ${app.name}`)
                            : handleQuickAction('open_app', { app: app.command }, `Launch ${app.name}`)
                        }
                        className="w-full py-2 bg-red-950/50 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/60 hover:border-red-500 rounded font-mono text-xs transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      >
                        Launch Now
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Running Processes Table */}
              <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-3">
                <span className="font-mono text-sm font-semibold text-slate-200">RUNNING TASK PROCESSES</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-red-950/80 text-slate-400">
                        <th className="pb-2">PROCESS</th>
                        <th className="pb-2">PID</th>
                        <th className="pb-2">CPU</th>
                        <th className="pb-2">MEMORY</th>
                        <th className="pb-2">STATUS</th>
                        <th className="pb-2 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/80 text-slate-300">
                      {[
                        { name: 'chrome.exe', pid: '14280', cpu: '8.4%', mem: '1.42 GB', status: 'Running' },
                        { name: 'Code.exe', pid: '9344', cpu: '4.1%', mem: '840 MB', status: 'Running' },
                        { name: 'python.exe (agent.py)', pid: '1832', cpu: '0.2%', mem: '45 MB', status: 'Secure' },
                        { name: 'node.exe (server.js)', pid: '7412', cpu: '0.4%', mem: '68 MB', status: 'Active' },
                        { name: 'Spotify.exe', pid: '11024', cpu: '1.2%', mem: '235 MB', status: 'Running' }
                      ].map((proc, i) => (
                        <tr key={i} className="hover:bg-red-950/20">
                          <td className="py-2.5 font-semibold text-white">{proc.name}</td>
                          <td className="py-2.5 text-slate-400">{proc.pid}</td>
                          <td className="py-2.5 text-cyan-400">{proc.cpu}</td>
                          <td className="py-2.5 text-slate-300">{proc.mem}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-900 text-[10px]">
                              {proc.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleQuickAction('system_status', {}, `Inspect PID ${proc.pid}`)}
                              className="px-2.5 py-1 bg-black/60 border border-slate-800 hover:border-red-500 text-slate-400 hover:text-white rounded"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FILES */}
          {activeTab === 'files' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">SAFE FILESYSTEM BROWSER</h2>
                  <p className="font-mono text-xs text-slate-400">Restricted sandbox directory: d:\JARVIS\workspace</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded font-mono text-xs">
                  SANDBOX ENFORCED
                </span>
              </div>

              {/* Create Safe Folder Input Bar */}
              <div className="cyber-glass-panel rounded-xl p-4 flex items-center gap-3">
                <Folder className="w-5 h-5 text-red-400" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter new directory name (e.g. 'research', 'projects', 'backups')"
                  className="flex-1 bg-black/60 border border-slate-800 rounded px-3 py-2 font-mono text-xs text-white outline-none focus:border-red-500"
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || isExecuting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded font-mono text-xs font-semibold shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                >
                  Create Folder
                </button>
              </div>

              {/* Sandbox Folders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {createdFolders.map((folder, idx) => (
                  <div
                    key={idx}
                    className="cyber-glass-panel rounded-xl p-4 flex items-center justify-between group hover:border-red-500 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-8 h-8 text-red-400 group-hover:scale-110 transition-transform" />
                      <div>
                        <h4 className="font-mono text-xs font-bold text-white truncate max-w-[130px]">{folder}</h4>
                        <span className="text-[10px] font-mono text-slate-500">Read / Write Safe</span>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                ))}
              </div>

              {/* Safety Policy Explainer */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-xs font-mono text-slate-300">
                <span className="font-bold text-red-400 block mb-1">ZERO-TRUST FILESYSTEM GUARANTEE:</span>
                File creation and navigation is strictly constrained inside <code className="text-cyan-300">d:\JARVIS\workspace</code>. Path traversal (e.g. <code className="text-red-400">../</code>) and system disk modification are permanently blocked by the safe command validator.
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM */}
          {activeTab === 'system' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">HARDWARE TELEMETRY & ARCHITECTURE</h2>
                  <p className="font-mono text-xs text-slate-400">Deep hardware matrix, thermal sensors, and memory allocation</p>
                </div>
                <button
                  onClick={() => handleQuickAction('system_status', {}, 'Query Hardware Metrics')}
                  className="px-3 py-1 bg-red-950/60 border border-red-700/60 text-red-300 rounded font-mono text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Query Hardware
                </button>
              </div>

              {/* Phase 7 Live Telemetry Dashboard */}
              <SystemDashboard />

              {/* Hardware Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* CPU Card */}
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-red-400 font-bold">PROCESSOR</span>
                    <Cpu className="w-4 h-4 text-red-400" />
                  </div>
                  <h3 className="font-mono text-sm font-bold text-white">Intel Core i7-13700H</h3>
                  <span className="text-[11px] font-mono text-slate-400">14 Cores / 20 Threads • 4.9 GHz</span>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Utilization:</span>
                    <span className="text-cyan-400 font-bold">{cpuVal}%</span>
                  </div>
                </div>

                {/* RAM Card */}
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-cyan-400 font-bold">MEMORY</span>
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h3 className="font-mono text-sm font-bold text-white">16 GB DDR5 Dual-Channel</h3>
                  <span className="text-[11px] font-mono text-slate-400">4800 MHz • CL40 Low Latency</span>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Used:</span>
                    <span className="text-cyan-400 font-bold">{ramUsed} ({ramVal}%)</span>
                  </div>
                </div>

                {/* GPU Card */}
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-emerald-400 font-bold">GRAPHICS</span>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-mono text-sm font-bold text-white">NVIDIA GeForce RTX 4060</h3>
                  <span className="text-[11px] font-mono text-slate-400">8 GB GDDR6 • Ray Tracing Cores</span>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Thermal:</span>
                    <span className="text-emerald-400 font-bold">52°C • 2100 RPM</span>
                  </div>
                </div>
              </div>

              {/* System Thermal & Battery Matrix */}
              <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-4">
                <span className="font-mono text-sm font-semibold text-slate-200">THERMAL MATRIX & POWER GRIDS</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono text-xs">
                  <div className="p-3 bg-black/60 rounded-lg border border-slate-900">
                    <span className="text-slate-400 block text-[10px]">CPU PACKAGE</span>
                    <span className="text-lg font-bold text-cyan-400">48°C</span>
                  </div>
                  <div className="p-3 bg-black/60 rounded-lg border border-slate-900">
                    <span className="text-slate-400 block text-[10px]">GPU CORE</span>
                    <span className="text-lg font-bold text-emerald-400">52°C</span>
                  </div>
                  <div className="p-3 bg-black/60 rounded-lg border border-slate-900">
                    <span className="text-slate-400 block text-[10px]">NVME SSD</span>
                    <span className="text-lg font-bold text-slate-200">38°C</span>
                  </div>
                  <div className="p-3 bg-black/60 rounded-lg border border-slate-900">
                    <span className="text-slate-400 block text-[10px]">COOLING FANS</span>
                    <span className="text-lg font-bold text-red-400">2400 RPM</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUTOMATION */}
          {activeTab === 'automation' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">AUTOMATION & PROACTIVE PROTOCOLS</h2>
                  <p className="font-mono text-xs text-slate-400">Trigger-action event loops connecting phone telemetry to laptop commands</p>
                </div>
                <span className="px-2.5 py-1 bg-red-950/80 text-red-400 border border-red-800/60 rounded font-mono text-xs">
                  4 RULES ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Auto-Lock on Disconnect',
                    trigger: 'Phone Socket disconnected > 30 seconds',
                    action: 'Issue lock PC & screen sleep command',
                    active: true
                  },
                  {
                    title: 'Morning Awakening Routine',
                    trigger: 'Daily at 08:00 AM (Phone proximity detected)',
                    action: 'Query system status, open VS Code, un-mute master audio',
                    active: true
                  },
                  {
                    title: 'Battery Critical Safeguard',
                    trigger: 'Laptop battery falls below 15%',
                    action: 'Notify phone with high-priority push, dim screen to 20%',
                    active: true
                  },
                  {
                    title: 'Night Focus Lockdown',
                    trigger: 'Every night at 02:00 AM',
                    action: 'Terminate non-essential tasks, engage sleep mode',
                    active: false
                  }
                ].map((rule, idx) => (
                  <div
                    key={idx}
                    className="cyber-glass-panel rounded-xl p-5 flex flex-col justify-between gap-3 group hover:border-red-600 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-red-400" />
                        <h4 className="font-mono text-sm font-bold text-white">{rule.title}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          rule.active
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        {rule.active ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs font-mono">
                      <div className="text-slate-400">
                        <span className="text-slate-500">TRIGGER:</span> {rule.trigger}
                      </div>
                      <div className="text-cyan-300">
                        <span className="text-slate-500">ACTION:</span> {rule.action}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (soundEnabled) audioFx.playClick();
                      }}
                      className="w-full py-1.5 bg-black/60 hover:bg-red-950/40 border border-slate-800 hover:border-red-600/70 text-slate-300 hover:text-white rounded font-mono text-xs transition-colors"
                    >
                      Configure Rule Trigger
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: SECURITY */}
          {activeTab === 'security' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">ZERO-TRUST SECURITY ENCLAVE</h2>
                  <p className="font-mono text-xs text-slate-400">Cryptographic tokens, authorization policies, and anti-tamper telemetry</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded font-mono text-xs">
                  DEFENSE LEVEL 4
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-2">
                  <span className="font-mono text-xs text-slate-400">AGENT AUTH TOKEN</span>
                  <div className="font-mono text-sm font-bold text-emerald-400 truncate">
                    jarvis_laptop_secret_token_2026
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Handshake verified over Socket.IO</span>
                </div>

                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-2">
                  <span className="font-mono text-xs text-slate-400">COMMAND VALIDATOR</span>
                  <div className="font-mono text-sm font-bold text-white">4 ACTIONS APPROVED</div>
                  <span className="text-[10px] font-mono text-emerald-400">Shell execution: PERMANENTLY BLOCKED</span>
                </div>

                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-2">
                  <span className="font-mono text-xs text-slate-400">TAMPER ATTEMPTS</span>
                  <div className="font-mono text-sm font-bold text-cyan-400">0 DETECTED</div>
                  <span className="text-[10px] font-mono text-slate-500">Path traversal protection active</span>
                </div>
              </div>

              {/* Whitelist Rules */}
              <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-3">
                <span className="font-mono text-sm font-semibold text-slate-200">STRICT COMMAND WHITELIST</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-black/60 rounded border border-slate-900 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">system_status</span>
                      <span className="text-slate-500 text-[11px]">Hardware metrics (CPU, RAM, Disk)</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div className="p-3 bg-black/60 rounded border border-slate-900 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">open_url</span>
                      <span className="text-slate-500 text-[11px]">Whitelisted protocols (http/https only)</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div className="p-3 bg-black/60 rounded border border-slate-900 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">create_folder</span>
                      <span className="text-slate-500 text-[11px]">Sandbox only inside d:\JARVIS\workspace</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div className="p-3 bg-black/60 rounded border border-slate-900 flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold block">open_app</span>
                      <span className="text-slate-500 text-[11px]">Whitelisted binaries (code, notepad, calc)</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">COMMAND AUDIT LOG</h2>
                  <p className="font-mono text-xs text-slate-400">Chronological ledger of executed voice and phone commands</p>
                </div>
                <span className="px-2.5 py-1 bg-red-950/80 text-red-400 border border-red-800/60 rounded font-mono text-xs">
                  {history.length} RECORDS
                </span>
              </div>

              <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-3">
                {history.length === 0 ? (
                  <div className="py-12 text-center font-mono text-xs text-slate-500">
                    No commands recorded in this session yet. Issue a voice or text command to populate.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded bg-black/60 border border-slate-900 flex items-center justify-between font-mono text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.success ? 'bg-emerald-400' : 'bg-rose-500'
                            }`}
                          />
                          <div>
                            <span className="text-white font-bold block">{item.label}</span>
                            <span className="text-[10px] text-slate-500">
                              Action: {item.action} • Source: {item.source || 'phone'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-[11px]">{item.timestamp}</span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                              item.success
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                                : 'bg-red-950 text-red-400 border border-red-900'
                            }`}
                          >
                            {item.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="p-6 flex flex-col gap-6 max-w-5xl">
              <div className="flex items-center justify-between pb-3 border-b border-red-950/60">
                <div>
                  <h2 className="font-mono text-xl font-bold text-white glow-text-red">SYSTEM CONFIGURATION</h2>
                  <p className="font-mono text-xs text-slate-400">Server networking, AI personality presets, and HUD customization</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-4">
                  <span className="font-mono text-sm font-semibold text-slate-200">BLAKE AI PERSONA</span>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between p-3 rounded bg-red-950/30 border border-red-600/70 text-xs font-mono">
                      <div>
                        <span className="text-white font-bold block">Blake (Sophisticated & Disciplined)</span>
                        <span className="text-slate-400 text-[10px]">Sharp, precise, confident, slightly villainous</span>
                      </div>
                      <input type="radio" checked readOnly className="accent-red-500" />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded bg-black/40 border border-slate-900 text-xs font-mono text-slate-500">
                      <div>
                        <span className="font-bold block">Standard IGRIS</span>
                        <span className="text-[10px]">Gentle and polite butler persona</span>
                      </div>
                      <input type="radio" disabled className="accent-red-500" />
                    </label>
                  </div>
                </div>

                <div className="cyber-glass-panel rounded-xl p-5 flex flex-col gap-4">
                  <span className="font-mono text-sm font-semibold text-slate-200">HUD AESTHETICS & AUDIO</span>
                  <div className="flex flex-col gap-3 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Sci-Fi Sound FX</span>
                      <button
                        onClick={() => {
                          setSoundEnabled(!soundEnabled);
                          audioFx.setEnabled(!soundEnabled);
                        }}
                        className={`px-3 py-1 rounded text-xs font-mono ${
                          soundEnabled ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {soundEnabled ? 'ENABLED' : 'MUTED'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Neon Red Glow Bloom</span>
                      <span className="text-red-400 font-bold">100% MAXIMUM</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Holographic Reticle Spin</span>
                      <span className="text-cyan-400 font-bold">ACTIVE (28s Loop)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* IGRIS Voice Personality Settings */}
              <div className="w-full">
                <VoiceSettings />
              </div>
            </div>
          )}

          {/* Persistent Windows Taskbar Footer */}
          <footer className="h-10 w-full bg-[#03060c] border-t border-red-950/60 px-4 flex items-center justify-between text-[11px] font-mono text-slate-500 z-30 select-none">
            <div className="flex items-center gap-3">
              <span className="text-red-500 font-bold">IGRIS DESKTOP</span>
              <span>•</span>
              <span>WINDOWS 11 COMPATIBLE</span>
              <span>•</span>
              <span className="text-slate-400">PHONE CONNECTED</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-semibold">“DISCIPLINE CREATES FREEDOM” — BLAKE</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DesktopDashboard;
