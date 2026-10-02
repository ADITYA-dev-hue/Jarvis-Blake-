import React, { useState } from 'react';
import {
  Zap,
  Plus,
  Play
} from 'lucide-react';
import { AutomationRule } from './types';
import audioFx from '../../services/audioFx';

interface AutomationScreenProps {
  onExecuteCommand: (action: string, params: Record<string, any>, label: string) => Promise<void>;
}

export const AutomationScreen: React.FC<AutomationScreenProps> = ({ onExecuteCommand }) => {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: 'r1',
      title: 'Dev Workstation Morning Setup',
      trigger: 'Phone connects between 8:00 AM – 10:00 AM',
      action: 'Open Chrome + Open VS Code + Set Volume 50%',
      active: true,
      lastRun: 'Today, 8:15 AM'
    },
    {
      id: 'r2',
      title: 'Auto-Lock Disconnect Guard',
      trigger: 'Phone socket disconnected > 30 seconds',
      action: 'Lock Windows PC & Sleep Displays',
      active: true,
      lastRun: 'Yesterday'
    },
    {
      id: 'r3',
      title: 'Battery Critical Protection',
      trigger: 'Laptop battery level drops below 20%',
      action: 'Send urgent phone push notification & Dim screen to 20%',
      active: true,
      lastRun: '3 days ago'
    },
    {
      id: 'r4',
      title: 'Midnight Silence Protocol',
      trigger: 'Clock reaches 02:00 AM daily',
      action: 'Mute master volume & Engage sleep mode',
      active: false
    }
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState('Phone connects to Wi-Fi');
  const [selectedAction, setSelectedAction] = useState('Open Chrome + Open VS Code');

  const toggleRule = (id: string) => {
    audioFx.playClick();
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const handleTestRun = async (rule: AutomationRule) => {
    audioFx.playClick();
    await onExecuteCommand('system_status', {}, `Automated: ${rule.title}`);
    audioFx.playSuccess();
  };

  const handleCreateRule = () => {
    if (!newTitle.trim()) return;
    audioFx.playClick();
    setRules((prev) => [
      {
        id: `r-${Date.now()}`,
        title: newTitle.trim(),
        trigger: selectedTrigger,
        action: selectedAction,
        active: true
      },
      ...prev
    ]);
    setNewTitle('');
    setShowCreateModal(false);
    audioFx.playSuccess();
  };

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Title */}
      <div className="flex items-center justify-between pb-1 border-b border-red-950/60">
        <div>
          <h2 className="font-mono text-base font-bold text-white tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-500" />
            AUTOMATION MATRIX
          </h2>
          <p className="font-mono text-[10px] text-slate-400">WHEN &rarr; THEN Proactive Windows Event Handlers</p>
        </div>
        <button
          onClick={() => { audioFx.playClick(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 border border-red-700 text-red-300 font-mono text-[10px] font-bold"
        >
          <Plus className="w-3 h-3" />
          <span>New Rule</span>
        </button>
      </div>

      {/* Rules List */}
      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`p-4 rounded-2xl bg-[#070b14]/90 border transition-all ${
              rule.active ? 'border-red-950/80 hover:border-red-600/80' : 'border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${rule.active ? 'text-red-400' : 'text-slate-600'}`} />
                <h4 className="font-mono text-xs font-bold text-white">{rule.title}</h4>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => toggleRule(rule.id)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                  rule.active ? 'bg-red-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    rule.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Trigger & Action Blocks */}
            <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-900 text-[11px] font-mono">
              <div className="flex items-start gap-2 text-slate-400">
                <span className="px-1.5 py-0.2 rounded bg-black/50 border border-slate-800 text-[9px] text-cyan-400 font-bold shrink-0">
                  WHEN
                </span>
                <span>{rule.trigger}</span>
              </div>
              <div className="flex items-start gap-2 text-slate-200">
                <span className="px-1.5 py-0.2 rounded bg-red-950/60 border border-red-900/60 text-[9px] text-red-400 font-bold shrink-0">
                  THEN
                </span>
                <span className="font-semibold">{rule.action}</span>
              </div>
            </div>

            {/* Footer with Test Run button */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-900/60 text-[10px] font-mono text-slate-500">
              <span>Last run: {rule.lastRun || 'Never'}</span>
              <button
                onClick={() => handleTestRun(rule)}
                className="flex items-center gap-1 text-cyan-400 hover:text-white"
              >
                <Play className="w-3 h-3" />
                <span>Test Action</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-[#070b14] border border-red-600/80 flex flex-col gap-3 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
            <h3 className="font-mono text-sm font-bold text-white">Create Automation Protocol</h3>
            
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] text-slate-400">RULE NAME</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Code Focus Routine"
                className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none focus:border-red-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] text-slate-400">WHEN (TRIGGER)</label>
              <select
                value={selectedTrigger}
                onChange={(e) => setSelectedTrigger(e.target.value)}
                className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none"
              >
                <option value="Phone connects to Wi-Fi">Phone connects to Wi-Fi</option>
                <option value="Phone disconnects > 30s">Phone disconnects &gt; 30s</option>
                <option value="Battery drops below 20%">Battery drops below 20%</option>
                <option value="Time reaches 8:00 AM">Time reaches 8:00 AM</option>
                <option value="Time reaches 11:00 PM">Time reaches 11:00 PM</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] text-slate-400">THEN (ACTION)</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono text-white outline-none"
              >
                <option value="Open Chrome + Open VS Code">Open Chrome + Open VS Code</option>
                <option value="Lock Windows PC">Lock Windows PC</option>
                <option value="Take Screenshot & Save">Take Screenshot & Save</option>
                <option value="Set Master Volume to 50%">Set Master Volume to 50%</option>
                <option value="Mute Volume & Sleep Displays">Mute Volume & Sleep Displays</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-lg font-mono text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 rounded-lg bg-red-600 font-mono text-xs text-white font-bold disabled:opacity-40"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationScreen;
