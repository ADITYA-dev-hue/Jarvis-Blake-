import React, { useState, useEffect } from 'react';
import {
  Home,
  Sliders,
  Grid,
  Folder,
  MoreHorizontal,
  Mic,
  Send,
  Sparkles,
  Settings,
  Cpu,
  Zap,
  Shield,
  AlertTriangle,
  Monitor,
  Columns,
  Wifi,
  Battery
} from 'lucide-react';
import { ConnectionState, AgentStatusState, AiStatusState, SystemStatusData, HistoryItem } from '../../types/command';
import { MobileTab } from './types';
import HomeScreen from './HomeScreen';
import ControlScreen from './ControlScreen';
import AppsScreen from './AppsScreen';
import FilesScreen from './FilesScreen';
import SystemScreen from './SystemScreen';
import AutomationScreen from './AutomationScreen';
import SecurityScreen from './SecurityScreen';
import AskBlakeScreen from './AskBlakeScreen';
import audioFx from '../../services/audioFx';
import useDeviceStatus from '../../services/useDeviceStatus';
import { ViewMode } from '../MultiViewSwitcher';

import VoiceStatus from '../VoiceStatus';

interface MobileAppProps {
  connectionState: ConnectionState;
  agentStatus: AgentStatusState;
  agentId: string;
  aiStatus: AiStatusState;
  systemData: SystemStatusData | null;
  history: HistoryItem[];
  onExecuteCommand: (action: string, params: Record<string, any>, label: string) => Promise<void>;
  onSendAiCommand: (text: string, source: 'text' | 'voice') => Promise<any>;
  onSwitchToDesktop?: () => void;
  onOpenVoiceSettings?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  isExecuting: boolean;
  stepMessage: string | null;
}

export const MobileApp: React.FC<MobileAppProps> = ({
  connectionState,
  agentStatus,
  agentId,
  aiStatus,
  systemData,
  history,
  onExecuteCommand,
  onSendAiCommand,
  onSwitchToDesktop,
  onOpenVoiceSettings,
  viewMode,
  onViewModeChange,
  isExecuting,
  stepMessage
}) => {
  const deviceStatus = useDeviceStatus(systemData);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [showAskBlake, setShowAskBlake] = useState(false);
  const [quickInputText, setQuickInputText] = useState('');

  // Confirmation dialog state for sensitive directives
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: string;
    params: Record<string, any>;
    label: string;
    description: string;
  }>({
    isOpen: false,
    action: '',
    params: {},
    label: '',
    description: ''
  });

  useEffect(() => {
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    document.title = `IGRIS — BLAKE | ${tabName}`;
  }, [activeTab]);

  const handleTabSelect = (tab: MobileTab) => {
    audioFx.playTabSwitch();
    setActiveTab(tab);
    setShowMoreDrawer(false);
  };

  const handleRequestConfirm = (
    action: string,
    params: Record<string, any>,
    label: string,
    description: string
  ) => {
    audioFx.playAlert();
    setConfirmModal({
      isOpen: true,
      action,
      params,
      label,
      description
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.action) return;
    const { action, params, label } = confirmModal;
    setConfirmModal({ isOpen: false, action: '', params: {}, label: '', description: '' });
    audioFx.playClick();
    await onExecuteCommand(action, params, label);
    audioFx.playSuccess();
  };

  const handleSendQuickInput = async () => {
    if (!quickInputText.trim() || isExecuting) return;
    const txt = quickInputText.trim();
    setQuickInputText('');
    audioFx.playClick();
    await onSendAiCommand(txt, 'text');
    audioFx.playSuccess();
  };

  return (
    <div className="w-full sm:max-w-[420px] min-h-screen bg-[#03060c] text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden sm:border-x sm:border-red-950/40 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      {/* ========================================================================= */}
      {/* 1. IPHONE / DEVICE STATUS BAR                                            */}
      {/* ========================================================================= */}
      <div className="h-10 w-full px-5 flex items-center justify-between text-xs font-mono text-slate-300 z-40 bg-[#03060c]/90 backdrop-blur-md sticky top-0">
        <span className="font-bold tracking-tight text-white">{deviceStatus.timeOnly}</span>

        {/* Dynamic Island Pill with Live Voice Status */}
        <div className="flex items-center justify-center">
          <VoiceStatus />
        </div>

        <div className="flex items-center gap-1.5">
          <Wifi className={`w-3.5 h-3.5 ${deviceStatus.isOnline ? 'text-slate-300' : 'text-slate-600'}`} />
          <div className={`flex items-center gap-1 text-[10px] ${
            deviceStatus.battery.percent > 20 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {deviceStatus.battery.charging ? (
              <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
            ) : (
              <Battery className="w-3.5 h-3.5" />
            )}
            <span className="font-bold">{deviceStatus.battery.percent}%</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP HEADER: BRANDING & CONTROLS                                       */}
      {/* ========================================================================= */}
      <header className="px-4 py-2 flex items-center justify-between border-b border-red-950/60 bg-[#050913]/90 backdrop-blur-md sticky top-10 z-30">
        {/* Left Crest */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-black border border-red-500/80 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.4)] overflow-hidden p-0.5">
            <img src="/favicon-32x32.png" alt="IGRIS" className="w-full h-full object-contain rounded-md" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono font-black tracking-widest text-sm text-white glow-text-red">
              IGRIS
            </span>
            <span className="font-mono text-[10px] font-bold tracking-widest text-red-500 uppercase -mt-0.5">
              B L A K E
            </span>
          </div>
        </div>

        {/* Right Status Badge & Switcher */}
        <div className="flex items-center gap-2">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-slate-800 text-[9px] font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionState === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-slate-300">{agentStatus.toUpperCase()}</span>
          </div>

          {/* Multi-View Mode Switcher Buttons */}
          {onViewModeChange ? (
            <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-red-950/80">
              <button
                onClick={() => onViewModeChange('desktop')}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  viewMode === 'desktop' ? 'bg-red-900/60 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Switch to Desktop Dashboard"
              >
                <Monitor className="w-3 h-3 text-red-400" />
                <span className="hidden xs:inline">PC</span>
              </button>
              <button
                onClick={() => onViewModeChange('dual')}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  viewMode === 'dual' ? 'bg-red-900/60 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Switch to Dual Multi-View"
              >
                <Columns className="w-3 h-3 text-cyan-400" />
                <span className="hidden xs:inline">DUAL</span>
              </button>
            </div>
          ) : (
            onSwitchToDesktop && (
              <button
                onClick={onSwitchToDesktop}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-700/60 text-red-300 font-mono text-[10px] transition-all"
                title="Switch to Blake Desktop HUD"
              >
                <Monitor className="w-3 h-3 text-red-400" />
                <span>DESKTOP</span>
              </button>
            )
          )}

          <button
            onClick={() => handleTabSelect('security')}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
            title={aiStatus}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. ACTIVE SCREEN CONTENT VIEWPORT                                        */}
      {/* ========================================================================= */}
      <main className="flex-1 px-3.5 pt-3 overflow-y-auto">
        {activeTab === 'home' && (
          <HomeScreen
            systemData={systemData}
            agentId={agentId}
            history={history}
            onExecuteCommand={onExecuteCommand}
            onOpenAskBlake={() => setShowAskBlake(true)}
            onOpenVoiceSettings={onOpenVoiceSettings}
            onNavigateTab={(tab) => handleTabSelect(tab)}
            onRequestConfirm={handleRequestConfirm}
          />
        )}

        {activeTab === 'control' && (
          <ControlScreen
            onExecuteCommand={onExecuteCommand}
            onRequestConfirm={handleRequestConfirm}
            isExecuting={isExecuting}
            stepMessage={stepMessage}
          />
        )}

        {activeTab === 'apps' && (
          <AppsScreen onExecuteCommand={onExecuteCommand} />
        )}

        {activeTab === 'files' && (
          <FilesScreen onExecuteCommand={onExecuteCommand} />
        )}

        {activeTab === 'system' && (
          <SystemScreen
            systemData={systemData}
            onRefresh={() => onExecuteCommand('system_status', {}, 'System Refresh')}
          />
        )}

        {activeTab === 'automation' && (
          <AutomationScreen onExecuteCommand={onExecuteCommand} />
        )}

        {activeTab === 'security' && (
          <SecurityScreen
            agentId={agentId}
            onDisconnect={() => onExecuteCommand('system_status', {}, 'Session Disconnect')}
            onReconnect={() => onExecuteCommand('system_status', {}, 'Token Re-Handshake')}
          />
        )}
      </main>

      {/* ========================================================================= */}
      {/* 4. PERSISTENT "ASK BLAKE..." BOTTOM INPUT BAR                             */}
      {/* ========================================================================= */}
      {activeTab !== 'ask_blake' && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[420px] px-3 z-30 pointer-events-auto">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#050913]/95 border border-red-600/70 shadow-[0_0_20px_rgba(239,68,68,0.35)] backdrop-blur-xl">
            {/* Glowing Red Microphone Button */}
            <button
              onClick={() => {
                audioFx.playMicPulse();
                setShowAskBlake(true);
              }}
              className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.7)] transition-all shrink-0"
              title="Voice Directive with Blake"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Quick Text Input */}
            <input
              type="text"
              value={quickInputText}
              onChange={(e) => setQuickInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuickInput()}
              placeholder="Ask Blake..."
              className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-white placeholder-slate-400 px-2"
              disabled={isExecuting}
            />

            {/* Send Button */}
            <button
              onClick={handleSendQuickInput}
              disabled={!quickInputText.trim() || isExecuting}
              className="w-9 h-9 rounded-xl bg-red-950/80 hover:bg-red-600 border border-red-700/80 text-red-300 hover:text-white disabled:opacity-30 flex items-center justify-center transition-all shrink-0"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FIXED GLOBAL NAVIGATION BAR                                           */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-14 bg-[#03060c]/98 border-t border-red-950/70 px-4 flex items-center justify-around z-40 backdrop-blur-xl">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'control', label: 'Control', icon: Sliders },
          { id: 'apps', label: 'Apps', icon: Grid },
          { id: 'files', label: 'Files', icon: Folder }
        ].map((item) => {
          const ItemIcon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabSelect(item.id as MobileTab)}
              className={`flex flex-col items-center justify-center py-1 transition-all ${
                isActive ? 'text-red-500 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ItemIcon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''
                }`}
              />
              <span className="font-mono text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => {
            audioFx.playClick();
            setShowMoreDrawer(!showMoreDrawer);
          }}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            showMoreDrawer || ['system', 'automation', 'security'].includes(activeTab)
              ? 'text-red-500 font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="font-mono text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 6. "MORE" BOTTOM DRAWER SHEET                                            */}
      {/* ========================================================================= */}
      {showMoreDrawer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div
            className="w-full max-w-[420px] mx-auto bg-[#070b14] border-t-2 border-red-600 rounded-t-3xl p-5 flex flex-col gap-3 shadow-[0_-10px_35px_rgba(239,68,68,0.3)] animate-in slide-in-from-bottom"
          >
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-900 font-mono text-xs">
              <span className="text-white font-bold">ADDITIONAL MATRIX SCREENS</span>
              <button onClick={() => setShowMoreDrawer(false)} className="text-slate-500">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleTabSelect('system')}
                className="p-3.5 rounded-xl bg-black/60 hover:bg-red-950/40 border border-slate-900 hover:border-red-600 flex items-center gap-3 transition-all text-left"
              >
                <Cpu className="w-5 h-5 text-red-400" />
                <div>
                  <div className="font-mono text-xs font-bold text-white">System</div>
                  <div className="font-mono text-[9px] text-slate-500">Hardware & Gauges</div>
                </div>
              </button>

              <button
                onClick={() => handleTabSelect('automation')}
                className="p-3.5 rounded-xl bg-black/60 hover:bg-red-950/40 border border-slate-900 hover:border-red-600 flex items-center gap-3 transition-all text-left"
              >
                <Zap className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="font-mono text-xs font-bold text-white">Automation</div>
                  <div className="font-mono text-[9px] text-slate-500">WHEN &rarr; THEN Rules</div>
                </div>
              </button>

              <button
                onClick={() => handleTabSelect('security')}
                className="p-3.5 rounded-xl bg-black/60 hover:bg-red-950/40 border border-slate-900 hover:border-red-600 flex items-center gap-3 transition-all text-left"
              >
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-mono text-xs font-bold text-white">Security</div>
                  <div className="font-mono text-[9px] text-slate-500">Zero-Trust Enclave</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowMoreDrawer(false);
                  setShowAskBlake(true);
                }}
                className="p-3.5 rounded-xl bg-black/60 hover:bg-red-950/40 border border-slate-900 hover:border-red-600 flex items-center gap-3 transition-all text-left"
              >
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="font-mono text-xs font-bold text-white">Ask Blake</div>
                  <div className="font-mono text-[9px] text-slate-500">Holographic AI Core</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FULLSCREEN DEDICATED "ASK BLAKE" MODAL                                */}
      {/* ========================================================================= */}
      {showAskBlake && (
        <AskBlakeScreen
          onClose={() => setShowAskBlake(false)}
          onSendAiCommand={onSendAiCommand}
          isExecuting={isExecuting}
          stepMessage={stepMessage}
        />
      )}

      {/* ========================================================================= */}
      {/* 8. SENSITIVE DIRECTIVE CONFIRMATION MODAL                                 */}
      {/* ========================================================================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs p-5 rounded-2xl bg-[#070b14] border-2 border-red-600 flex flex-col gap-3 shadow-[0_0_35px_rgba(239,68,68,0.5)]">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
              <h3 className="font-mono text-sm font-bold tracking-wide">CONFIRM DIRECTIVE</h3>
            </div>
            <p className="font-mono text-xs text-slate-300">
              {confirmModal.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ isOpen: false, action: '', params: {}, label: '', description: '' })}
                className="px-3.5 py-1.5 rounded-lg bg-black/60 border border-slate-800 text-slate-400 font-mono text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold shadow-[0_0_12px_rgba(239,68,68,0.6)]"
              >
                Confirm {confirmModal.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileApp;
