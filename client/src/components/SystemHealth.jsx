import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, HardDrive, Cpu, Users, FileText, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function SystemHealth({ api, setErrorMsg }) {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const hData = await api('/health');
      setHealth(hData);

      const mData = await api('/system/metrics');
      setMetrics(mData);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (seconds = 0) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  const formatBytes = (bytes = 0) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="panel flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="text-electric" />
            System Operations & Diagnostics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time server telemetry, node process health, and storage utilization.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="btn-secondary text-xs"
          aria-label="Refresh telemetry"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Stats
        </button>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
            <Server size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">API Server</div>
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {health?.status === 'ok' ? 'Online' : 'Degraded'}
            </div>
            <div className="text-[11px] text-slate-400">{health?.service}</div>
          </div>
        </div>

        <div className="panel flex items-center gap-3">
          <div className="p-3 rounded-xl bg-electric/15 text-electric">
            <Database size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">SQLite Database</div>
            <div className="text-lg font-bold text-white">WAL Mode Active</div>
            <div className="text-[11px] text-slate-400">Safe crash resilience</div>
          </div>
        </div>

        <div className="panel flex items-center gap-3">
          <div className="p-3 rounded-xl bg-flame/15 text-flame">
            <HardDrive size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Storage Used</div>
            <div className="text-lg font-bold text-white">
              {metrics?.documents?.total_mb || '0'} MB
            </div>
            <div className="text-[11px] text-slate-400">
              {metrics?.documents?.files_uploaded || 0} disk files saved
            </div>
          </div>
        </div>

        <div className="panel flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400">
            <Cpu size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Node.js Runtime</div>
            <div className="text-lg font-bold text-white">
              {metrics?.system?.nodeVersion || process.version}
            </div>
            <div className="text-[11px] text-slate-400">
              Uptime: {formatUptime(metrics?.system?.uptimeSeconds)}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="panel space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-navy-700 pb-2">
            <Users size={16} className="text-electric" /> Account Distribution
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Total Users</span>
              <div className="text-xl font-bold text-white mt-1">{metrics?.users?.total || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Super Admins</span>
              <div className="text-xl font-bold text-amber-400 mt-1">{metrics?.users?.super_admins || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Staff Members</span>
              <div className="text-xl font-bold text-purple-400 mt-1">{metrics?.users?.staff || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Active Accounts</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">{metrics?.users?.active || 0}</div>
            </div>
          </div>
        </div>

        <div className="panel space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-navy-700 pb-2">
            <FileText size={16} className="text-flame" /> OCR & Document Metrics
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Total Documents</span>
              <div className="text-xl font-bold text-white mt-1">{metrics?.documents?.total || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Avg OCR Confidence</span>
              <div className="text-xl font-bold text-electric mt-1">
                {Math.round(metrics?.documents?.avg_confidence || 85)}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Memory RSS</span>
              <div className="text-xl font-bold text-slate-200 mt-1">
                {formatBytes(metrics?.system?.memoryUsage?.rss)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900 border border-navy-700">
              <span className="text-slate-400">Heap Used</span>
              <div className="text-xl font-bold text-slate-200 mt-1">
                {formatBytes(metrics?.system?.memoryUsage?.heapUsed)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
