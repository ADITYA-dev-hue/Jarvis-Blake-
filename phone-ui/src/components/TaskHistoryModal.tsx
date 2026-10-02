import React, { useState, useEffect } from 'react';
import { History, X, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { TaskHistoryItem } from '../types/command';
import audioFx from '../services/audioFx';

interface TaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl?: string;
}

export const TaskHistoryModal: React.FC<TaskHistoryModalProps> = ({
  isOpen,
  onClose,
  serverUrl
}) => {
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = serverUrl || (typeof window !== 'undefined' ? `http://${window.location.hostname}:3000` : 'http://localhost:3000');
      const res = await fetch(`${baseUrl}/api/tasks/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load task history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-[#060a14] border border-cyan-900/60 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden font-mono flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-[#0a1224] to-slate-900 border-b border-cyan-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center">
              <History className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider text-white uppercase">
                TASK EXECUTION HISTORY
              </h3>
              <p className="text-[10px] text-cyan-400 font-mono">
                BOUNDED WORKFLOW AUDIT LOG (MAX 50)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh History"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                audioFx.playClick();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && tasks.length === 0 && (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <span>Loading task records...</span>
            </div>
          )}

          {!loading && tasks.length === 0 && !error && (
            <div className="py-12 text-center text-slate-500 font-mono">
              No recent workflows recorded yet.
            </div>
          )}

          {tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isCancelled = task.status === 'cancelled';
            const statusColor = isCompleted
              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
              : isCancelled
              ? 'text-yellow-400 bg-yellow-950/60 border-yellow-800/60'
              : 'text-red-400 bg-red-950/60 border-red-800/60';

            return (
              <div
                key={task.taskId}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-900/60 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isCancelled ? (
                      <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span className="font-bold text-slate-200 truncate max-w-[240px]">
                      "{task.originalUserRequest}"
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${statusColor}`}>
                    {task.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span>
                      Steps: <strong className="text-slate-300">{task.completedSteps}/{task.steps}</strong>
                    </span>
                    <span>
                      Lang: <strong className="text-cyan-400 uppercase">{task.detectedLanguage}</strong>
                    </span>
                  </div>
                  <span>{new Date(task.timestamp).toLocaleTimeString()}</span>
                </div>

                {task.resultSummary && (
                  <div className="text-[10px] text-slate-400 truncate">
                    Summary: {task.resultSummary}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskHistoryModal;
