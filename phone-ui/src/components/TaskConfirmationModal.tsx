import React from 'react';
import { ShieldAlert, Check, X, AlertTriangle, ListOrdered, ArrowRight } from 'lucide-react';
import { TaskConfirmationRequiredEvent } from '../types/command';
import audioFx from '../services/audioFx';

interface TaskConfirmationModalProps {
  isOpen: boolean;
  data: TaskConfirmationRequiredEvent | null;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const TaskConfirmationModal: React.FC<TaskConfirmationModalProps> = ({
  isOpen,
  data,
  onConfirm,
  onCancel,
  isProcessing = false
}) => {
  if (!isOpen || !data) return null;

  const handleConfirm = () => {
    audioFx.playSuccess();
    onConfirm();
  };

  const handleCancel = () => {
    audioFx.playAlert();
    onCancel();
  };

  const steps = data.taskSummary?.stepActions || [];
  const stepCount = data.taskSummary?.steps || steps.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#070b14] border-2 border-red-600/70 rounded-2xl shadow-[0_0_50px_rgba(255,30,68,0.35)] overflow-hidden font-mono flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-950/80 via-black to-red-950/80 border-b border-red-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/50 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider text-white uppercase glow-text-red">
                TASK APPROVAL REQUIRED
              </h3>
              <p className="text-[10px] text-red-400 font-mono">
                WORKFLOW CONTAINS {stepCount} STEPS • SAFE CONFIRMATION GATE
              </p>
            </div>
          </div>

          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* User directive */}
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">
              User Directive ({data.language ? data.language.toUpperCase() : 'AUTO'})
            </div>
            <div className="text-slate-200 text-sm font-medium">
              "{data.userText}"
            </div>
          </div>

          {/* Planned Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase">
                <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                Planned Steps ({stepCount})
              </span>
              <span className="text-[10px] text-yellow-400 bg-yellow-950/60 border border-yellow-800/60 px-2 py-0.5 rounded font-bold">
                REQUIRES APPROVAL
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {steps.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-red-900/60 transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-red-950/80 border border-red-800/60 text-red-300 text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1 font-mono text-slate-200 text-xs">
                    <span className="text-cyan-400 font-semibold">{action}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                </div>
              ))}
            </div>
          </div>

          {/* Safety alert message */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-950/30 border border-red-900/50 text-[11px] text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              {data.message || 'Multi-step automation detected. Please verify approved actions before execution.'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-900 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold shadow-[0_0_20px_rgba(255,30,68,0.5)] transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Approve & Continue</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskConfirmationModal;
