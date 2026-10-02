import { useState, useEffect, useCallback } from 'react';
import socketService from './services/socket';
import {
  ConnectionState,
  AgentStatusState,
  AiStatusState,
  SystemStatusData,
  HistoryItem,
  ToastMessage
} from './types/command';
import Toast from './components/Toast';
import DesktopDashboard from './components/desktop/DesktopDashboard';
import MobileApp from './components/mobile/MobileApp';
import ConversationHistory from './components/ConversationHistory';
import ttsService from './services/textToSpeech';
import conversationManager from './services/conversationManager';
import { VoiceSettings } from './types/voice';
import MultiViewSwitcher, { ViewMode } from './components/MultiViewSwitcher';
import SplashScreen from './components/SplashScreen';

const STORAGE_KEY_HISTORY = 'jarvis_phone_history_v1';
const STORAGE_KEY_VOICE = 'jarvis_voice_settings_v1';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth >= 1280) {
        return 'dual';
      }
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        return 'desktop';
      }
    } catch {}
    return 'desktop';
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [agentStatus, setAgentStatus] = useState<AgentStatusState>('offline');
  const [agentId, setAgentId] = useState<string>('LAPTOP-01');
  const [aiStatus, setAiStatus] = useState<AiStatusState>('AI CONNECTING');
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Dynamic Browser Tab Title - IGRIS — BLAKE
  useEffect(() => {
    document.title = 'IGRIS — BLAKE';
  }, []);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [systemData, setSystemData] = useState<SystemStatusData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [voiceSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOICE);
      return saved
        ? JSON.parse(saved)
        : {
            voiceEnabled: true,
            autoSpeakResponses: true,
            language: 'en-IN'
          };
    } catch {
      return {
        voiceEnabled: true,
        autoSpeakResponses: true,
        language: 'en-IN'
      };
    }
  });

  // Toast helper
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 30)));
    } catch {
      // Ignore storage errors
    }
  }, [history]);

  // Subscribe to Socket.IO events
  useEffect(() => {
    const unsubConn = socketService.onConnectionChange((state) => {
      setConnectionState(state);
      if (state === 'CONNECTED') {
        setAiStatus('AI READY');
        addToast('info', 'Connected to IGRIS Server');
      } else if (state === 'DISCONNECTED') {
        setAiStatus('AI CONNECTING');
        addToast('error', 'IGRIS server is unavailable.');
      } else if (state === 'ERROR') {
        setAiStatus('AI ERROR');
        addToast('error', 'Server connection error.');
      }
    });

    const unsubAgent = socketService.onAgentStatusChange((status, id) => {
      setAgentStatus(status);
      setAgentId(id);
      if (status === 'online') {
        addToast('success', `Laptop Agent ${id} is Online`);
      } else {
        addToast('info', `Laptop Agent ${id} is Offline`);
      }
    });

    return () => {
      unsubConn();
      unsubAgent();
    };
  }, [addToast]);

  // Friendly error formatter
  const formatFriendlyError = (err: any): string => {
    const str = String(err?.message || err?.error || err || '');
    if (str.includes('offline') || str.includes('Offline')) {
      return 'Your laptop is currently offline.';
    }
    if (str.includes('timed out') || str.includes('time')) {
      return 'The laptop did not respond in time.';
    }
    if (str.includes('unavailable') || str.includes('connect')) {
      return 'IGRIS server is unavailable.';
    }
    if (str.includes('disallowed') || str.includes('whitelisted') || str.includes('Security') || str.includes('forbidden')) {
      return 'IGRIS blocked this command for security reasons.';
    }
    if (str.includes('Authentication failed')) {
      return 'Phone authentication failed.';
    }
    return str || 'Command execution failed.';
  };

  // Save voice settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(voiceSettings));
    } catch {
      // Ignore
    }
  }, [voiceSettings]);


  // Phase 3, 4 & 5 Natural-Language AI Command Handler (Supports Text & Voice input with Context)
  const handleSendAiCommand = async (userText: string, source: 'text' | 'voice' = 'text') => {
    if (isExecuting) return;

    if (connectionState !== 'CONNECTED') {
      const offlineMsg = 'IGRIS server is unavailable.';
      addToast('error', offlineMsg);
      if (source === 'voice' && voiceSettings.autoSpeakResponses) {
        ttsService.speak(offlineMsg, voiceSettings.language);
      }
      return;
    }

    // 1. Record user message in ConversationManager
    conversationManager.addUserMessage(userText, source);

    setIsExecuting(true);
    setAiStatus('AI THINKING');
    setStepMessage('Understanding request...');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const response = await socketService.sendAiCommand(
        userText,
        conversationManager.getSessionId(),
        source
      );

      if (response.success) {
        const actionName = response.interpretedCommand?.action || 'command';
        setStepMessage(`Executing ${actionName}...`);

        setTimeout(() => setStepMessage('Completed ✓'), 400);

        addToast('success', `Completed: ${actionName}`);

        // Update live telemetry if action is system_status
        if (actionName === 'system_status' && response.result?.data) {
          setSystemData(response.result.data);
        }

        const friendlyMsg = response.message || 'Command executed successfully.';

        // 2. Record assistant message in ConversationManager
        conversationManager.addAssistantMessage(friendlyMsg, actionName, true);

        // Speak response if autoSpeakResponses is enabled
        if (voiceSettings.autoSpeakResponses) {
          ttsService.speak(friendlyMsg, voiceSettings.language);
        }

        setHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            commandId: response.result?.commandId || `cmd-${Date.now()}`,
            action: actionName,
            label: userText,
            userText: userText,
            interpretedAction: actionName,
            source,
            timestamp: timeStr,
            success: true,
            data: response.result?.data
          },
          ...prev
        ]);
      } else {
        const msg = response.message || "I can't perform that action yet.";
        addToast('error', msg);

        // Record assistant response in ConversationManager
        conversationManager.addAssistantMessage(
          msg,
          response.interpretedCommand?.action || 'unsupported',
          false
        );

        // Speak rejection if autoSpeakResponses is enabled
        if (voiceSettings.autoSpeakResponses) {
          ttsService.speak(msg, voiceSettings.language);
        }

        setHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            commandId: `err-${Date.now()}`,
            action: response.interpretedCommand?.action || 'unsupported',
            label: userText,
            userText: userText,
            interpretedAction: response.interpretedCommand?.action || 'unsupported',
            source,
            timestamp: timeStr,
            success: false,
            error: msg
          },
          ...prev
        ]);
      }
    } catch (err: any) {
      const msg = formatFriendlyError(err);
      addToast('error', msg);

      // Record error in ConversationManager
      conversationManager.addAssistantMessage(msg, 'unsupported', false);

      if (voiceSettings.autoSpeakResponses) {
        ttsService.speak(msg, voiceSettings.language);
      }

      setHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          commandId: `err-${Date.now()}`,
          action: 'unsupported',
          label: userText,
          userText: userText,
          interpretedAction: 'unsupported',
          source,
          timestamp: timeStr,
          success: false,
          error: msg
        },
        ...prev
      ]);
    } finally {
      setTimeout(() => {
        setIsExecuting(false);
        setAiStatus('AI READY');
        setStepMessage(null);
      }, 700);
    }
  };

  const handleClearConversation = async () => {
    try {
      const sessionId = conversationManager.getSessionId();
      await socketService.clearSession(sessionId);
      conversationManager.clearHistory();
      addToast('info', 'Conversation session cleared.');
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to clear session.');
    }
  };

  // Direct Quick Action Preset Handler
  const handleExecuteCommand = async (
    action: string,
    parameters: Record<string, any> = {},
    label: string
  ) => {
    if (isExecuting) return;

    if (connectionState !== 'CONNECTED') {
      addToast('error', 'IGRIS server is unavailable.');
      return;
    }

    if (agentStatus === 'offline') {
      addToast('error', 'Your laptop is currently offline.');
      return;
    }

    conversationManager.addUserMessage(label, 'text');
    setIsExecuting(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const result = await socketService.sendCommand(action, parameters);

      if (result.success) {
        addToast('success', `${label} completed successfully`);
        conversationManager.addAssistantMessage(`${label} completed successfully.`, action, true);

        if (action === 'system_status' && result.data) {
          setSystemData(result.data);
        }

        setHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            commandId: result.commandId,
            action,
            label,
            userText: label,
            interpretedAction: action,
            timestamp: timeStr,
            success: true,
            data: result.data
          },
          ...prev
        ]);
      } else {
        const friendlyError = formatFriendlyError(result.error);
        addToast('error', friendlyError);
        conversationManager.addAssistantMessage(friendlyError, action, false);

        setHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            commandId: result.commandId,
            action,
            label,
            userText: label,
            interpretedAction: action,
            timestamp: timeStr,
            success: false,
            error: friendlyError
          },
          ...prev
        ]);
      }
    } catch (err: any) {
      const friendlyError = formatFriendlyError(err);
      addToast('error', friendlyError);
      conversationManager.addAssistantMessage(friendlyError, action, false);

      setHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          commandId: `err-${Date.now()}`,
          action,
          label,
          userText: label,
          interpretedAction: action,
          timestamp: timeStr,
          success: false,
          error: friendlyError
        },
        ...prev
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Desktop Full View
  if (viewMode === 'desktop') {
    return (
      <div className="min-h-screen w-full bg-[#03060c] text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <DesktopDashboard
          connectionState={connectionState}
          agentStatus={agentStatus}
          agentId={agentId}
          aiStatus={aiStatus}
          systemData={systemData}
          history={history}
          onExecuteCommand={handleExecuteCommand}
          onSendAiCommand={handleSendAiCommand}
          onSwitchToMobile={() => setViewMode('mobile')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isExecuting={isExecuting}
          stepMessage={stepMessage}
        />
      </div>
    );
  }

  // Dual Multi-View Mode (Desktop + Phone Side-by-Side)
  if (viewMode === 'dual') {
    return (
      <div className="min-h-screen w-full bg-[#020409] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <Toast toasts={toasts} onDismiss={dismissToast} />

        {/* Persistent Floating Multi-View Controller Header */}
        <div className="w-full h-12 bg-[#050913]/95 backdrop-blur-md border-b border-red-950/80 px-4 flex items-center justify-between text-xs z-50 sticky top-0 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold tracking-widest text-slate-100 uppercase text-sm glow-text-red">
              IGRIS // BLAKE
            </span>
            <span className="hidden sm:inline text-[10px] bg-red-950/80 text-red-400 border border-red-800/50 px-2 py-0.5 rounded font-mono font-bold">
              DUAL MULTI-VIEW ENGINE
            </span>
          </div>

          <MultiViewSwitcher currentMode={viewMode} onModeChange={setViewMode} />
        </div>

        {/* Side-by-Side Dual Viewport */}
        <div className="flex-1 flex flex-col xl:flex-row w-full overflow-hidden">
          {/* Left: Full Desktop Dashboard */}
          <div className="flex-1 min-w-0 border-b xl:border-b-0 xl:border-r border-red-950/70 overflow-y-auto">
            <DesktopDashboard
              connectionState={connectionState}
              agentStatus={agentStatus}
              agentId={agentId}
              aiStatus={aiStatus}
              systemData={systemData}
              history={history}
              onExecuteCommand={handleExecuteCommand}
              onSendAiCommand={handleSendAiCommand}
              onSwitchToMobile={() => setViewMode('mobile')}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isExecuting={isExecuting}
              stepMessage={stepMessage}
            />
          </div>

          {/* Right: Connected Phone Remote in iPhone 16 Pro Mockup Frame */}
          <div className="w-full xl:w-[460px] 2xl:w-[480px] bg-[#03060c] p-4 xl:p-6 flex flex-col items-center justify-start overflow-y-auto flex-shrink-0 border-t xl:border-t-0 border-red-950/80">
            <div className="mb-3 text-center">
              <span className="font-mono text-[10px] text-cyan-400 tracking-widest uppercase font-bold block">
                CONNECTED PHONE REMOTE CONTROLLER
              </span>
              <span className="font-mono text-[9px] text-slate-500">
                IPHONE 16 PRO • LIVE E2E SYNC • PORT 3000
              </span>
            </div>

            {/* Realistic iPhone Device Frame */}
            <div className="w-full max-w-[400px] rounded-[44px] p-2 bg-gradient-to-b from-slate-700 via-slate-900 to-black shadow-[0_0_40px_rgba(255,30,68,0.3),0_25px_60px_rgba(0,0,0,0.9)] border border-red-800/40 relative">
              <div className="w-full rounded-[38px] overflow-hidden">
                <MobileApp
                  connectionState={connectionState}
                  agentStatus={agentStatus}
                  agentId={agentId}
                  aiStatus={aiStatus}
                  systemData={systemData}
                  history={history}
                  onExecuteCommand={handleExecuteCommand}
                  onSendAiCommand={handleSendAiCommand}
                  onSwitchToDesktop={() => setViewMode('desktop')}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  isExecuting={isExecuting}
                  stepMessage={stepMessage}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Phone View
  return (
    <div className="min-h-screen bg-[#020409] text-slate-100 flex flex-col items-center justify-start relative overflow-x-hidden font-sans py-2 sm:py-6">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {/* Floating Toast Notification Stack */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
      {false && <ConversationHistory messages={[]} onClear={handleClearConversation} />}

      {/* Top Multi-View Switcher Bar */}
      <div className="mb-4 z-50">
        <MultiViewSwitcher currentMode={viewMode} onModeChange={setViewMode} />
      </div>

      {/* iPhone 16 Pro Frame Wrapper on screens >= 640px */}
      <div className="w-full max-w-[420px] sm:rounded-[44px] sm:p-2 sm:bg-gradient-to-b sm:from-slate-700 sm:via-slate-900 sm:to-black sm:shadow-[0_0_50px_rgba(255,30,68,0.25),0_20px_50px_rgba(0,0,0,0.9)] sm:border sm:border-red-900/40 relative">
        <div className="w-full sm:rounded-[38px] overflow-hidden">
          <MobileApp
            connectionState={connectionState}
            agentStatus={agentStatus}
            agentId={agentId}
            aiStatus={aiStatus}
            systemData={systemData}
            history={history}
            onExecuteCommand={handleExecuteCommand}
            onSendAiCommand={handleSendAiCommand}
            onSwitchToDesktop={() => setViewMode('desktop')}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isExecuting={isExecuting}
            stepMessage={stepMessage}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
