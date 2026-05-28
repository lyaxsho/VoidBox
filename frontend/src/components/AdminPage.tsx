import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, FileText, HardDrive, ShieldCheck, Search, Trash2,
  CheckCircle, XCircle, Shield, Unlink, ChevronLeft, ChevronRight,
  RefreshCw, Lock,
} from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Stats {
  users: { total: number; verified: number; telegram: number };
  files: { total: number; secure: number; standard: number };
  storage: number;
}

interface AdminUser {
  _id: string; email?: string; first_name: string; last_name?: string;
  email_verified: boolean; is_admin?: boolean; telegram_id?: number;
  secure_upload_enabled: boolean; file_count: number; total_size: number;
  created_at: string;
}

interface AdminFile {
  _id: string; name: string; size: number; mimetype: string; slug: string;
  storage_mode: string; download_count: number; user_id: string;
  user_email?: string; created_at: string;
}

interface AdminPageProps {
  currentUser?: { is_admin?: boolean } | null;
}

export default function AdminPage({ currentUser }: AdminPageProps) {
  const [authed, setAuthed]         = useState(!!currentUser?.is_admin);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError]   = useState('');
  const [adminSecret, setAdminSecret] = useState('');

  const [tab, setTab]       = useState<'stats' | 'users' | 'files'>('stats');
  const [stats, setStats]   = useState<Stats | null>(null);
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [files, setFiles]   = useState<AdminFile[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [fileTotal, setFileTotal] = useState(0);
  const [userPage, setUserPage]   = useState(1);
  const [filePage, setFilePage]   = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [filePages, setFilePages] = useState(1);
  const [userQ, setUserQ]   = useState('');
  const [fileQ, setFileQ]   = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const adminFetch = useCallback((path: string, opts?: RequestInit) => {
    const token = localStorage.getItem('voidbox_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (adminSecret) headers['x-admin-secret'] = adminSecret;
    return fetch(`${BASE_URL}/api/admin${path}`, { ...opts, headers: { ...headers, ...(opts?.headers ?? {}) } });
  }, [adminSecret]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const token = localStorage.getItem('voidbox_token');
    const res = await fetch(`${BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ secret: secretInput }),
    });
    if (res.ok) {
      setAdminSecret(secretInput);
      setAuthed(true);
    } else {
      setAuthError('Invalid credentials');
    }
  };

  const fetchStats = useCallback(async () => {
    const res = await adminFetch('/stats');
    if (res.ok) setStats(await res.json());
  }, [adminFetch]);

  const fetchUsers = useCallback(async (page = 1, q = '') => {
    setLoading(true);
    const res = await adminFetch(`/users?page=${page}&limit=20&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setUserTotal(data.total);
      setUserPages(data.pages);
    }
    setLoading(false);
  }, [adminFetch]);

  const fetchFiles = useCallback(async (page = 1, q = '') => {
    setLoading(true);
    const res = await adminFetch(`/files?page=${page}&limit=20&q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      setFileTotal(data.total);
      setFilePages(data.pages);
    }
    setLoading(false);
  }, [adminFetch]);

  useEffect(() => {
    if (!authed) return;
    fetchStats();
  }, [authed, fetchStats]);

  useEffect(() => {
    if (!authed || tab !== 'users') return;
    fetchUsers(userPage, userQ);
  }, [authed, tab, userPage, userQ, fetchUsers]);

  useEffect(() => {
    if (!authed || tab !== 'files') return;
    fetchFiles(filePage, fileQ);
  }, [authed, tab, filePage, fileQ, fetchFiles]);

  const userAction = async (id: string, action: string) => {
    const res = await adminFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
    if (res.ok) {
      setActionMsg(`Done: ${action.replace('_', ' ')}`);
      fetchUsers(userPage, userQ);
      fetchStats();
      setTimeout(() => setActionMsg(''), 2500);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user and all their files? This cannot be undone.')) return;
    const res = await adminFetch(`/users/${id}`, { method: 'DELETE' });
    if (res.ok) { fetchUsers(userPage, userQ); fetchStats(); }
  };

  const deleteFile = async (id: string) => {
    if (!confirm('Delete this file?')) return;
    const res = await adminFetch(`/files/${id}`, { method: 'DELETE' });
    if (res.ok) { fetchFiles(filePage, fileQ); fetchStats(); }
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="w-full max-w-sm bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-10"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div className="text-center mb-8">
            <Lock className="mx-auto mb-4 text-gray-300 dark:text-gray-700" size={32} />
            <h1 className="text-2xl font-normal text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              Admin Access
            </h1>
            <p className="text-sm text-gray-400 mt-1">Enter your admin secret to continue</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="password"
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
              placeholder="Admin secret"
              autoFocus
              className="w-full py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-500 dark:focus:border-gray-500 transition-colors"
            />
            {authError && <p className="text-xs text-red-500 text-center">{authError}</p>}
            <motion.button
              type="submit"
              className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-bold"
              whileTap={{ scale: 0.98 }}
            >
              Enter
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-normal text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
          VoidBox Admin
        </span>
        <div className="flex items-center gap-3">
          {actionMsg && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs text-emerald-500 font-medium">
              {actionMsg}
            </motion.span>
          )}
          <button onClick={() => { fetchStats(); tab === 'users' && fetchUsers(userPage, userQ); tab === 'files' && fetchFiles(filePage, fileQ); }}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Users size={18}/>, label: 'Total Users',     value: stats.users.total,    sub: `${stats.users.verified} verified` },
              { icon: <ShieldCheck size={18}/>, label: 'Telegram Linked', value: stats.users.telegram, sub: `of ${stats.users.total} users` },
              { icon: <FileText size={18}/>, label: 'Total Files',   value: stats.files.total,   sub: `${stats.files.secure} secure · ${stats.files.standard} standard` },
              { icon: <HardDrive size={18}/>, label: 'Storage Used', value: formatSize(stats.storage), sub: 'across all files' },
            ].map(c => (
              <div key={c.label} className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 text-gray-400 mb-3">{c.icon}<span className="text-xs font-medium uppercase tracking-wide">{c.label}</span></div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit">
          {(['stats', 'users', 'files'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-white dark:bg-black text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {t}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-900 flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={userQ}
                      onChange={e => { setUserQ(e.target.value); setUserPage(1); }}
                      placeholder="Search by email…"
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-gray-400 transition-colors"
                    />
                  </div>
                  <span className="text-xs text-gray-400">{userTotal} user{userTotal !== 1 ? 's' : ''}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-900">
                        {['User', 'Status', 'Files', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                      {loading ? (
                        <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No users found</td></tr>
                      ) : users.map(u => (
                        <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{u.email || '—'}</div>
                            <div className="text-xs text-gray-400">{u.first_name}{u.last_name ? ` ${u.last_name}` : ''}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {u.email_verified
                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"><CheckCircle size={10}/>Verified</span>
                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-50 dark:bg-red-950 text-red-500"><XCircle size={10}/>Unverified</span>
                              }
                              {u.is_admin && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"><Shield size={10}/>Admin</span>}
                              {u.telegram_id && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">TG</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">
                            <div>{u.file_count} files</div>
                            <div className="text-xs">{formatSize(u.total_size)}</div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              {!u.email_verified && (
                                <button onClick={() => userAction(u._id, 'verify_email')} title="Verify email"
                                  className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors">
                                  <CheckCircle size={14}/>
                                </button>
                              )}
                              <button onClick={() => userAction(u._id, 'toggle_admin')} title={u.is_admin ? 'Remove admin' : 'Make admin'}
                                className={`p-1.5 rounded-lg transition-colors ${u.is_admin ? 'text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
                                <Shield size={14}/>
                              </button>
                              {u.telegram_id && (
                                <button onClick={() => userAction(u._id, 'unlink_telegram')} title="Unlink Telegram"
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
                                  <Unlink size={14}/>
                                </button>
                              )}
                              <button onClick={() => deleteUser(u._id)} title="Delete user"
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {userPages > 1 && (
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Page {userPage} of {userPages}</span>
                    <div className="flex gap-1">
                      <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={15}/>
                      </button>
                      <button disabled={userPage === userPages} onClick={() => setUserPage(p => p + 1)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors">
                        <ChevronRight size={15}/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'files' && (
            <motion.div key="files" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-900 flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={fileQ}
                      onChange={e => { setFileQ(e.target.value); setFilePage(1); }}
                      placeholder="Search by filename…"
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:border-gray-400 transition-colors"
                    />
                  </div>
                  <span className="text-xs text-gray-400">{fileTotal} file{fileTotal !== 1 ? 's' : ''}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-900">
                        {['File', 'Owner', 'Size', 'Mode', 'Downloads', 'Uploaded', 'Actions'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-900">
                      {loading ? (
                        <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
                      ) : files.length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">No files found</td></tr>
                      ) : files.map(f => (
                        <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{f.name}</div>
                            <div className="text-xs text-gray-400">{f.mimetype}</div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 text-xs">{f.user_email}</td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{formatSize(f.size)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              f.storage_mode === 'secure'
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                : 'bg-gray-100 dark:bg-gray-900 text-gray-500'
                            }`}>
                              {f.storage_mode}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-500">{f.download_count}</td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-500 text-xs">{formatDate(f.created_at)}</td>
                          <td className="px-5 py-3.5">
                            <button onClick={() => deleteFile(f._id)} title="Delete file"
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                              <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filePages > 1 && (
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Page {filePage} of {filePages}</span>
                    <div className="flex gap-1">
                      <button disabled={filePage === 1} onClick={() => setFilePage(p => p - 1)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors">
                        <ChevronLeft size={15}/>
                      </button>
                      <button disabled={filePage === filePages} onClick={() => setFilePage(p => p + 1)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors">
                        <ChevronRight size={15}/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
