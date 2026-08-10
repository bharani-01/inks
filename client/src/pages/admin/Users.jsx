import { useState, useEffect } from 'react';
import { api, previewUrl } from '../../lib/api';
import { useToast } from '../../components/Toaster';
import Pagination from '../../components/Pagination';
import { EmptyState } from '../../components/States';
import Modal from '../../components/Modal';
import FileTypeIcon from '../../components/FileTypeIcon';
import Button from '../../components/Button';
import { formatDate, formatDateTime, formatMoney, formatFileSize, initials } from '../../lib/format';
import {
  Users as UsersIcon,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Mail,
  Phone,
  Calendar,
  Package,
  DollarSign,
  Printer,
  FileText,
  Clock,
  ShieldCheck,
  ExternalLink,
  Download,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-orange-100 text-orange-700',
  PRINTED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Selected User Detail Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalLoading, setUserModalLoading] = useState(false);

  const toast = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: 15,
        search,
        role: roleFilter,
      });
      const data = await api.get(`/users?${query}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openUserDetails = async (user) => {
    try {
      setUserModalLoading(true);
      setSelectedUser({ user });
      const data = await api.get(`/users/${user.id}`);
      setSelectedUser(data);
    } catch (err) {
      toast('Failed to load user profile', 'error');
    } finally {
      setUserModalLoading(false);
    }
  };

  const toggleStatus = async (user) => {
    if (user.id === currentUser.id) {
      return toast('You cannot change your own status.', 'error');
    }

    try {
      const data = await api.put(`/users/${user.id}/toggle-status`);
      toast(`User is now ${data.user.isActive ? 'Active' : 'Inactive'}`, 'success');
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: data.user.isActive } : u)));
      if (selectedUser && selectedUser.user?.id === user.id) {
        setSelectedUser((prev) => ({
          ...prev,
          user: { ...prev.user, isActive: data.user.isActive },
        }));
      }
    } catch (err) {
      toast(err.message || 'Failed to update user status', 'error');
    }
  };

  const changeRole = async (user, newRole) => {
    if (user.id === currentUser.id) {
      return toast('You cannot change your own role.', 'error');
    }

    try {
      const data = await api.put(`/users/${user.id}`, { role: newRole });
      toast(`User role updated to ${newRole}`, 'success');
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
      if (selectedUser && selectedUser.user?.id === user.id) {
        setSelectedUser((prev) => ({
          ...prev,
          user: { ...prev.user, role: newRole },
        }));
      }
    } catch (err) {
      toast(err.message || 'Failed to update user role', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">User Management</h1>
          <p className="text-ink-muted mt-1">Click any user to inspect their profile, joined date, and print history.</p>
        </div>
      </header>

      {/* Filter / Search Bar */}
      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent-soft outline-none text-sm transition-shadow"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="border border-line rounded-lg px-4 py-2 focus:ring-2 focus:ring-accent-soft outline-none text-sm bg-white"
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button type="submit" className="btn btn-secondary whitespace-nowrap">
            Search
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found" description="Adjust your search criteria." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">User Profile</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Joined Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => openUserDetails(u)}
                    className="hover:bg-paper-hover/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {initials(u.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-ink group-hover:text-accent transition-colors flex items-center gap-1.5">
                            {u.name}
                            {u.id === currentUser.id && (
                              <span className="text-[10px] bg-accent-soft text-accent px-1.5 py-0.2 rounded font-medium">You</span>
                            )}
                          </div>
                          <div className="text-xs text-ink-muted">{u.email}</div>
                          {u.phone && <div className="text-xs text-ink-muted">{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={u.role}
                        disabled={u.id === currentUser.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 border outline-none ${
                          u.id === currentUser.id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                            : 'bg-paper-hover text-ink border-line'
                        }`}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.isActive
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}
                      >
                        {u.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-ink-muted">
                      {formatDate(u.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openUserDetails(u)}
                          className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-paper-hover transition-colors"
                          title="View Full Profile"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(u)}
                          disabled={u.id === currentUser.id}
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-primary'} ${
                            u.id === currentUser.id ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* User Profile & Print History Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.user ? `User Profile · ${selectedUser.user.name}` : 'User Profile'}
        size="lg"
        footer={
          selectedUser?.user && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(selectedUser.user)}
                  disabled={selectedUser.user.id === currentUser.id}
                  className={`btn btn-sm ${selectedUser.user.isActive ? 'btn-danger' : 'btn-primary'} ${
                    selectedUser.user.id === currentUser.id ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  {selectedUser.user.isActive ? 'Deactivate Account' : 'Activate Account'}
                </button>
              </div>
              <Button variant="ghost" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          )
        }
      >
        {selectedUser?.user && (
          <div className="space-y-6">
            {/* Header info card */}
            <div className="p-5 rounded-2xl border border-line bg-paper-sunken flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-accent text-white flex items-center justify-center font-bold text-2xl shrink-0 ring-4 ring-white shadow-sm">
                  {initials(selectedUser.user.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                    {selectedUser.user.name}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedUser.user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {selectedUser.user.role}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                    <Mail size={13} /> {selectedUser.user.email}
                  </p>
                  {selectedUser.user.phone && (
                    <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                      <Phone size={13} /> {selectedUser.user.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-line sm:pl-5 space-y-1">
                <span className="text-xs text-ink-muted block">Joined Date</span>
                <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Calendar size={14} className="text-ink-muted" />
                  {formatDate(selectedUser.user.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${selectedUser.user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  ● {selectedUser.user.isActive ? 'Active Account' : 'Inactive Account'}
                </span>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-line bg-white">
                <span className="text-xs text-ink-muted flex items-center gap-1">
                  <Package size={13} /> Total Orders
                </span>
                <span className="text-xl font-bold font-display text-ink mt-1 block">
                  {selectedUser.stats?.ordersCount ?? '—'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-line bg-white">
                <span className="text-xs text-ink-muted flex items-center gap-1">
                  <DollarSign size={13} /> Total Spent
                </span>
                <span className="text-xl font-bold font-display text-accent mt-1 block">
                  {selectedUser.stats ? formatMoney(selectedUser.stats.totalSpent) : '—'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-line bg-white">
                <span className="text-xs text-ink-muted flex items-center gap-1">
                  <Printer size={13} /> Pages Printed
                </span>
                <span className="text-xl font-bold font-display text-ink mt-1 block">
                  {selectedUser.stats?.totalPagesPrinted ?? '—'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-line bg-white">
                <span className="text-xs text-ink-muted flex items-center gap-1">
                  <FileText size={13} /> Documents
                </span>
                <span className="text-xl font-bold font-display text-ink mt-1 block">
                  {selectedUser.stats?.documentsCount ?? '—'}
                </span>
              </div>
            </div>

            {/* Recent Orders History */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold font-display text-ink flex items-center gap-1.5">
                <Clock size={16} className="text-accent" /> Recent Print Jobs
              </h4>

              {userModalLoading ? (
                <div className="p-6 text-center text-ink-muted text-xs">Loading history…</div>
              ) : !selectedUser.recentOrders || selectedUser.recentOrders.length === 0 ? (
                <p className="p-4 rounded-xl border border-line bg-paper-sunken text-xs text-ink-muted text-center">
                  This user has not placed any print orders yet.
                </p>
              ) : (
                <div className="rounded-xl border border-line overflow-hidden bg-white">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Order</th>
                        <th className="px-4 py-2.5">Document</th>
                        <th className="px-4 py-2.5">Amount</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {selectedUser.recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-paper-hover/40">
                          <td className="px-4 py-2.5 font-mono font-semibold text-accent">{o.orderNumber}</td>
                          <td className="px-4 py-2.5 text-ink truncate max-w-[150px]" title={o.document?.originalName}>
                            {o.document?.originalName || 'Document'}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-ink">{formatMoney(o.totalAmount)}</td>
                          <td className="px-4 py-2.5 text-ink-muted">{formatDate(o.createdAt)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[o.orderStatus] || 'bg-paper-hover text-ink'}`}>
                              {o.orderStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Uploaded Files */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold font-display text-ink flex items-center gap-1.5">
                <FileText size={16} className="text-accent" /> Uploaded Documents
              </h4>

              {userModalLoading ? (
                <div className="p-6 text-center text-ink-muted text-xs">Loading documents…</div>
              ) : !selectedUser.recentDocuments || selectedUser.recentDocuments.length === 0 ? (
                <p className="p-4 rounded-xl border border-line bg-paper-sunken text-xs text-ink-muted text-center">
                  No documents found for this user.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedUser.recentDocuments.map((d) => (
                    <div key={d.id} className="p-3 rounded-xl border border-line bg-white flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileTypeIcon mimeType={d.mimeType} size={18} boxed />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate" title={d.originalName}>
                            {d.originalName}
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {formatFileSize(d.fileSize)} · {formatDate(d.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={previewUrl(d.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover"
                          title="Preview"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <a
                          href={previewUrl(d.id, { download: true })}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover"
                          title="Download"
                          download
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
