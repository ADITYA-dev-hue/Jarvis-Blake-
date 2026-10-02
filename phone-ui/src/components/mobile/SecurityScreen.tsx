import React, { useState } from 'react';
import {
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Smartphone,
  Laptop,
  RefreshCw,
  PowerOff
} from 'lucide-react';
import { SecurityLog } from './types';
import audioFx from '../../services/audioFx';

interface SecurityScreenProps {
  agentId: string;
  onDisconnect: () => void;
  onReconnect: () => void;
}

export const SecurityScreen: React.FC<SecurityScreenProps> = ({
  agentId,
  onDisconnect,
  onReconnect
}) => {
  const [logs] = useState<SecurityLog[]>([
    {
      id: 'l1',
      timestamp: 'Today, 2:10 PM',
      event: 'Socket.IO Handshake Auth',
      status: 'verified',
      details: 'Token verified for agent LAPTOP-01'
    },
    {
      id: 'l2',
      timestamp: 'Today, 2:14 PM',
      event: 'Command Policy Check',
      status: 'allowed',
      details: 'Action system_status approved'
    },
    {
      id: 'l3',
      timestamp: 'Today, 2:20 PM',
      event: 'Whitelisted URL Validation',
      status: 'allowed',
      details: 'https://github.com allowed (HTTPS scheme)'
    },
    {
      id: 'l4',
      timestamp: 'Today, 2:25 PM',
      event: 'Arbitrary Shell Injection Blocked',
      status: 'blocked',
      details: 'PowerShell / cmd execution rejected by zero-trust router'
    },
    {
      id: 'l5',
      timestamp: 'Today, 2:28 PM',
      event: 'Filesystem Sandbox Enforcement',
      status: 'allowed',
      details: 'Path locked inside d:\\JARVIS\\workspace'
    }
  ]);

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Title */}
      <div className="flex items-center justify-between pb-1 border-b border-red-950/60">
        <div>
          <h2 className="font-mono text-base font-bold text-white tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            ZERO-TRUST ENCLAVE
          </h2>
          <p className="font-mono text-[10px] text-slate-400">Cryptographic Defense & Device Authorization</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-[9px] font-mono text-emerald-400 font-bold">
          LEVEL 4 DEFENSE
        </span>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl bg-[#070b14]/90 border border-emerald-950/80 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>CONNECTION</span>
          </div>
          <span className="font-mono text-xs text-white font-bold">Authenticated</span>
          <span className="font-mono text-[9px] text-slate-500">Port 3000 • TLS 1.3</span>
        </div>

        <div className="p-3 rounded-2xl bg-[#070b14]/90 border border-cyan-950/80 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold">
            <Key className="w-4 h-4" />
            <span>ENCRYPTION</span>
          </div>
          <span className="font-mono text-xs text-white font-bold">SHA-256 HMAC</span>
          <span className="font-mono text-[9px] text-slate-500">Zero-Leak Token</span>
        </div>
      </div>

      {/* Authorized Devices */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1">
          AUTHORIZED DEVICES
        </span>
        <div className="flex flex-col gap-2">
          {/* Laptop */}
          <div className="p-3 rounded-xl bg-black/60 border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Laptop className="w-5 h-5 text-red-400" />
              <div>
                <div className="font-mono text-xs font-bold text-white">{agentId} (Windows Laptop)</div>
                <div className="font-mono text-[9px] text-slate-500">Connected via Python Agent • Localhost</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900 text-[9px] font-mono font-bold">
              ACTIVE
            </span>
          </div>

          {/* Phone */}
          <div className="p-3 rounded-xl bg-black/60 border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-mono text-xs font-bold text-white">iPhone 16 Pro (Mobile Remote)</div>
                <div className="font-mono text-[9px] text-slate-500">Connected via Browser Socket • 10.49.106.43</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900 text-[9px] font-mono font-bold">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Security Audit Logs */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1">
          REAL-TIME SECURITY LOGS
        </span>
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-[#070b14]/90 border border-slate-900 flex items-start justify-between gap-3 text-xs font-mono"
            >
              <div className="flex items-start gap-2.5">
                {log.status === 'blocked' ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-200">{log.event}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{log.details}</div>
                  <div className="text-[9px] text-slate-600 mt-1">{log.timestamp}</div>
                </div>
              </div>
              <span
                className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                  log.status === 'blocked'
                    ? 'bg-red-950 text-red-400 border border-red-900'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                }`}
              >
                {log.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Management Controls */}
      <div className="flex flex-col gap-2 pt-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase px-1">
          EMERGENCY SESSION PROTOCOLS
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              audioFx.playClick();
              onReconnect();
            }}
            className="p-3 rounded-xl bg-black/60 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500 flex items-center justify-center gap-2 font-mono text-xs text-cyan-300 font-bold transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Re-Authenticate</span>
          </button>

          <button
            onClick={() => {
              audioFx.playClick();
              onDisconnect();
            }}
            className="p-3 rounded-xl bg-red-950/30 hover:bg-red-950/70 border border-red-900/60 hover:border-red-600 flex items-center justify-center gap-2 font-mono text-xs text-red-400 font-bold transition-all"
          >
            <PowerOff className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityScreen;
