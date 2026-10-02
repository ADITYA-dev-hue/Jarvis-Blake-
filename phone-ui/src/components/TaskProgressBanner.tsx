import React from 'react';
import { CheckCircle2, Loader2, Circle, Activity } from 'lucide-react';
import { TaskProgressEvent } from '../types/command';

interface TaskProgressBannerProps {
  progress: TaskProgressEvent | null;
  activeAction?: string | null;
}

export const TaskProgressBanner: React.FC<TaskProgressBannerProps> = ({
  progress,
  activeAction
}) => {
  if (!progress || !progress.total || progress.total <= 1) return null;

  const currentStep = progress.step || 1;
  const totalSteps = progress.total || 1;
  const isFinished = currentStep > totalSteps;

  return (
    <div className="w-full bg-[#070d1a]/95 backdrop-blur-xl border border-cyan-900/50 rounded-2xl p-3 shadow-[0_0_25px_rgba(6,182,212,0.25)] font-mono text-xs my-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
            {isFinished ? 'Workflow Completed' : `Executing Step ${currentStep} of ${totalSteps}`}
          </span>
        </div>
        <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded">
          {Math.round(((currentStep - 1) / totalSteps) * 100)}% COMPLETE
        </span>
      </div>

      {/* Action name if active */}
      {activeAction && !isFinished && (
        <div className="text-[11px] text-slate-300 mb-2 truncate">
          Active: <span className="text-cyan-400 font-semibold">{activeAction}</span>
        </div>
      )}

      {/* Progress steps row */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep || isFinished;
          const isCurrent = stepNum === currentStep && !isFinished;

          return (
            <div
              key={i}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all flex-shrink-0 ${
                isDone
                  ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                  : isCurrent
                  ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-pulse'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : isCurrent ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
              ) : (
                <Circle className="w-3 h-3 text-slate-600" />
              )}
              <span>Step {stepNum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskProgressBanner;
