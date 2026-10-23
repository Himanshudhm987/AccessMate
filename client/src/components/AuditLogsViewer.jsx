import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, RefreshCw, Terminal, AlertTriangle, User, HardDrive } from 'lucide-react';

export default function AuditLogsViewer({ api, setErrorMsg }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (actionFilter) q.set('action', actionFilter);
      q.set('limit', '50');

      const data = await api(`/system/audit-logs?${q.toString()}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-6">
      <div className="panel flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-electric" />
            Security & Audit Logs Console
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident record of authentication, authorization, role modifications, and system events ({total} total entries).
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action (e.g. USER_LOGIN)"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          <button
            onClick={fetchLogs}
            className="btn-secondary text-xs"
            aria-label="Refresh logs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="panel p-0 overflow-hidden border border-navy-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-900/90 text-slate-400 uppercase font-semibold border-b border-navy-700">
              <tr>
                <th className="p-3.5">Time</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">IP Address</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/60 font-mono text-[11px]">
              {logs.map((log) => {
                const isBlocked = log.action.includes('BLOCKED') || log.action.includes('DENIED') || log.action.includes('FAILED');
                const isElevated = log.action.includes('ADMIN') || log.action.includes('SYSTEM');

                return (
                  <tr key={log.id} className="hover:bg-navy-700/30 transition">
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] ${
                          isBlocked
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isElevated
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-electric/15 text-electric border border-electric/30'
                        }`}
                      >
                        {isBlocked && <AlertTriangle size={10} />}
                        {log.action}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-300 whitespace-nowrap">
                      {log.user_email ? (
                        <span className="text-white font-sans text-xs">
                          {log.user_email}
                          <span className="ml-1 text-[10px] text-slate-400">({log.user_role})</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Unauthenticated</span>
                      )}
                    </td>

                    <td className="p-3.5 text-slate-400">
                      {log.ip_address || '127.0.0.1'}
                    </td>

                    <td className="p-3.5 text-slate-300 max-w-md break-all font-sans text-xs">
                      {log.details}
                    </td>
                  </tr>
                );
              })}

              {!logs.length && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                    No security events recorded matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
