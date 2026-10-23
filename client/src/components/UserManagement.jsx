import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, CheckCircle, Search, RefreshCw, Trash2, ShieldCheck, UserCheck } from 'lucide-react';

export default function UserManagement({ currentUser, api, notify, setErrorMsg }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // New user form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [createBusy, setCreateBusy] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (roleFilter) q.set('role', roleFilter);
      if (statusFilter) q.set('status', statusFilter);
      q.set('limit', '50');

      const data = await api(`/users?${q.toString()}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleRoleChange = async (userId, targetRole) => {
    try {
      await api(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: targetRole })
      });
      notify('User role updated successfully.');
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      notify(`User status set to ${nextStatus}.`);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${email}?`)) {
      return;
    }
    try {
      await api(`/users/${userId}`, { method: 'DELETE' });
      notify(`User ${email} deleted.`);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateBusy(true);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole
        })
      });
      notify('New user created successfully.');
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 panel">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-electric" />
            User Access & RBAC Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage system users, permission matrices, and account security statuses ({total} registered).
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="btn-secondary text-xs"
            title="Refresh user list"
            aria-label="Refresh user list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs"
          >
            <UserPlus size={14} />
            Add User
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
        </form>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="py-2 px-3 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white focus:border-electric"
        >
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="user">User</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="py-2 px-3 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white focus:border-electric"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="panel p-0 overflow-hidden border border-navy-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-900/90 text-slate-400 uppercase font-semibold border-b border-navy-700">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Registered</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/60">
              {users.map((u) => {
                const isSuperAdmin = u.role === 'super_admin';
                const isSelf = u.id === currentUser?.id;

                return (
                  <tr key={u.id} className="hover:bg-navy-700/30 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        {u.name}
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-electric/20 text-electric font-mono">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px]">{u.email}</div>
                    </td>

                    <td className="p-3.5">
                      <select
                        value={u.role}
                        disabled={currentUser?.role !== 'super_admin' && isSuperAdmin}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1 font-semibold border ${
                          u.role === 'super_admin'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : u.role === 'admin'
                            ? 'bg-electric/15 border-electric/40 text-electric'
                            : u.role === 'staff'
                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                            : 'bg-slate-700/50 border-slate-600 text-slate-300'
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        {currentUser?.role === 'super_admin' && (
                          <option value="super_admin">Super Admin</option>
                        )}
                      </select>
                    </td>

                    <td className="p-3.5">
                      <button
                        onClick={() => handleStatusToggle(u.id, u.status)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                          u.status === 'active'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {u.status === 'active' ? (
                          <>
                            <CheckCircle size={11} /> Active
                          </>
                        ) : (
                          <>
                            <ShieldAlert size={11} /> Suspended
                          </>
                        )}
                      </button>
                    </td>

                    <td className="p-3.5 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot delete own session account' : 'Delete user'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!users.length && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No users matching the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md"
          role="dialog"
        >
          <div className="panel w-full max-w-md border-navy-600 anime-entrance">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <UserCheck className="text-electric" /> Create System User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white"
                  placeholder="e.g. Ramesh Patel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white"
                  placeholder="ramesh@accessmate.org"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Password (min 8 chars)</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role Assignment</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white"
                >
                  <option value="user">User</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="btn-primary text-xs"
                >
                  {createBusy ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
