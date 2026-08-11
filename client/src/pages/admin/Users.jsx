import { useState, useEffect, useRef } from 'react';
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
  UserCheck,
  UserPlus,
  MoreVertical,
  Trash2,
  Lock,
  RefreshCw,
  Shield,
  UserX,
  EyeOff,
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
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // 3-dots action menu state
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Selected User Detail Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalLoading, setUserModalLoading] = useState(false);

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'USER',
    isActive: true,
  });

  // Delete User Confirmation Modal
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const toast = useToast();
  const { user: currentUser } = useAuth();
  const menuContainerRef = useRef(null);

  // Close 3-dots menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeMenuId !== null && !e.target.closest('.user-action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenuId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: 15,
        search,
        role: roleFilter,
        status: statusFilter,
      });
      const data = await api.get(`/users?${query}`);
      setUsers(data.users);
      setPagination(data.pagination);
      if (typeof data.pendingCount === 'number') {
        setPendingCount(data.pendingCount);
      }
    } catch (err) {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, statusFilter]);

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      return toast('Name, email, and password are required', 'error');
    }
    if (createForm.password.length < 6) {
      return toast('Password must be at least 6 characters', 'error');
    }

    try {
      setCreateLoading(true);
      const data = await api.post('/users', createForm);
      toast(data.message || `User ${createForm.name} created successfully!`, 'success');
      setCreateModalOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'USER',
        isActive: true,
      });
      fetchUsers();
    } catch (err) {
      toast(err.message || 'Failed to create user', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleStatus = async (user) => {
    if (user.id === currentUser.id) {
      return toast('You cannot change your own status.', 'error');
    }

    try {
      const data = await api.put(`/users/${user.id}/toggle-status`);
      const isNowActive = data.user.isActive;
      toast(
        isNowActive ? `Account for ${user.name} approved and activated!` : `Account for ${user.name} deactivated`,
        'success'
      );
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: isNowActive } : u)));
      if (selectedUser && selectedUser.user?.id === user.id) {
        setSelectedUser((prev) => ({
          ...prev,
          user: { ...prev.user, isActive: isNowActive },
        }));
      }
      fetchUsers();
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
      toast(`User role for ${user.name} updated to ${newRole === 'ADMIN' ? 'Administrator' : 'Standard User'}`, 'success');
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

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    try {
      setDeleteLoading(true);
      const data = await api.delete(`/users/${deleteTargetUser.id}`);
      toast(data.message || `User ${deleteTargetUser.name} deleted successfully`, 'success');
      setDeleteTargetUser(null);
      fetchUsers();
    } catch (err) {
      toast(err.message || 'Failed to delete user', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" ref={menuContainerRef}>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">User Management &amp; Approvals</h1>
          <p className="text-xs text-ink-muted mt-1">Review registrations, manage permissions, and add new users.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="btn btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus size={15} /> Add User
          </button>
        </div>
      </header>

      {/* Pending Approvals Alert Banner */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-200 text-amber-900 shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">
                {pendingCount} {pendingCount === 1 ? 'account' : 'accounts'} awaiting approval
              </p>
              <p className="text-xs text-amber-800">
                New signups require administrator verification before they can sign in and submit print jobs.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setStatusFilter('pending');
              setPage(1);
            }}
            className="btn btn-sm bg-amber-800 hover:bg-amber-900 text-white self-start sm:self-auto shrink-0 font-medium"
          >
            Review Pending Users ({pendingCount})
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-soft outline-none text-sm bg-white font-medium"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending Approval ({pendingCount})</option>
            <option value="active">Active Accounts</option>
            <option value="inactive">Inactive Accounts</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent-soft outline-none text-sm bg-white"
          >
            <option value="">All Roles</option>
            <option value="USER">User / Student</option>
            <option value="PRINTER_ADMIN">Printer Admin</option>
            <option value="ADMIN">Administrator</option>
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
          <EmptyState
            icon={UsersIcon}
            title={statusFilter === 'pending' ? 'No pending approvals' : 'No users found'}
            description={
              statusFilter === 'pending'
                ? 'All registered accounts are currently approved and active.'
                : 'Adjust your search or filter criteria.'
            }
          />
        ) : (
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-paper-hover border-b border-line text-ink-muted uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">User Profile</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Approval Status</th>
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
                          {u.phone && <div className="text-xs text-ink-muted mt-0.5">{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : u.role === 'PRINTER_ADMIN'
                            ? 'bg-teal-100 text-teal-700 border border-teal-200'
                            : 'bg-paper-hover text-ink border border-line'
                        }`}
                      >
                        {u.role === 'ADMIN' ? (
                          <ShieldCheck size={13} className="text-purple-600" />
                        ) : u.role === 'PRINTER_ADMIN' ? (
                          <Printer size={13} className="text-teal-600" />
                        ) : (
                          <User size={13} className="text-ink-muted" />
                        )}
                        {u.role === 'ADMIN' ? 'Administrator' : u.role === 'PRINTER_ADMIN' ? 'Printer Admin' : 'User / Student'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle size={12} /> Approved &amp; Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          Pending Approval
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-ink-muted">
                      {formatDate(u.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* 3-Dots Actions Menu */}
                      <div className="relative inline-block text-left user-action-menu-container">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                          className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-hover border border-line bg-white transition-colors"
                          title="Actions"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeMenuId === u.id && (
                          <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-pop border border-line py-1 z-40 animate-scale-in text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                openUserDetails(u);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-paper-hover flex items-center gap-2 text-ink transition-colors"
                            >
                              <Eye size={15} className="text-accent" />
                              View Profile &amp; History
                            </button>

                            {u.id !== currentUser.id && (
                              <>
                                <div className="my-1 border-t border-line" />
                                {u.role === 'USER' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        changeRole(u, 'PRINTER_ADMIN');
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-teal-50 flex items-center gap-2 text-teal-700 transition-colors"
                                    >
                                      <Printer size={15} className="text-teal-600" />
                                      Promote to Printer Admin
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        changeRole(u, 'ADMIN');
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-purple-50 flex items-center gap-2 text-purple-700 transition-colors"
                                    >
                                      <ShieldCheck size={15} className="text-purple-600" />
                                      Promote to Admin
                                    </button>
                                  </>
                                ) : u.role === 'PRINTER_ADMIN' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        changeRole(u, 'ADMIN');
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-purple-50 flex items-center gap-2 text-purple-700 transition-colors"
                                    >
                                      <ShieldCheck size={15} className="text-purple-600" />
                                      Promote to Admin
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        changeRole(u, 'USER');
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-paper-hover flex items-center gap-2 text-ink transition-colors"
                                    >
                                      <User size={15} className="text-ink-muted" />
                                      Demote to Standard User
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        changeRole(u, 'PRINTER_ADMIN');
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-teal-50 flex items-center gap-2 text-teal-700 transition-colors"
                                    >
                                      <Printer size={15} className="text-teal-600" />
                                      Demote to Printer Admin
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        changeRole(u, 'USER');
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-paper-hover flex items-center gap-2 text-ink transition-colors"
                                    >
                                      <User size={15} className="text-ink-muted" />
                                      Demote to Standard User
                                    </button>
                                  </>
                                )}

                                <div className="my-1 border-t border-line" />
                                {!u.isActive ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      toggleStatus(u);
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-green-50 flex items-center gap-2 text-green-700 transition-colors"
                                  >
                                    <UserCheck size={15} className="text-green-600" />
                                    Approve &amp; Activate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      toggleStatus(u);
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-amber-50 flex items-center gap-2 text-amber-700 transition-colors"
                                  >
                                    <UserX size={15} className="text-amber-600" />
                                    Deactivate Account
                                  </button>
                                )}

                                <div className="my-1 border-t border-line" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeleteTargetUser(u);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-600 transition-colors"
                                >
                                  <Trash2 size={15} className="text-rose-500" />
                                  Delete User
                                </button>
                              </>
                            )}
                          </div>
                        )}
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

      {/* CREATE NEW USER MODAL */}
      <Modal
        open={createModalOpen}
        onClose={() => (createLoading ? null : setCreateModalOpen(false))}
        title="Add New User"
        size="md"
      >
        <form onSubmit={handleCreateUser} autoComplete="off" className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={15} />
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="e.g. Alex Morgan"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full pl-10 pr-3.5 py-2.5 bg-paper-sunken border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1.5">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={15} />
              <input
                type="email"
                required
                autoComplete="off"
                placeholder="alex@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full pl-10 pr-3.5 py-2.5 bg-paper-sunken border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1.5">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={15} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Minimum 6 characters"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full pl-10 pr-10 py-2.5 bg-paper-sunken border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-ink-muted mt-1">The user can change their password anytime after signing in.</p>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1.5">Phone Number (Optional)</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" size={15} />
              <input
                type="tel"
                autoComplete="off"
                placeholder="+91 98765 43210"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full pl-10 pr-3.5 py-2.5 bg-paper-sunken border border-line rounded-xl text-xs text-ink placeholder:text-ink-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-medium text-ink mb-1.5">Account Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-paper-sunken border border-line rounded-xl text-xs font-medium text-ink focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all cursor-pointer"
              >
                <option value="USER">User / Student</option>
                <option value="PRINTER_ADMIN">Printer Admin</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink mb-1.5">Account Status</label>
              <select
                value={createForm.isActive ? 'active' : 'pending'}
                onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.value === 'active' })}
                className="w-full px-3.5 py-2.5 bg-paper-sunken border border-line rounded-xl text-xs font-medium text-ink focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all cursor-pointer"
              >
                <option value="active">Active &amp; Approved</option>
                <option value="pending">Pending Approval</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createLoading}
              loadingText="Creating user..."
            >
              <UserPlus size={15} /> Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE USER CONFIRMATION MODAL */}
      <Modal
        open={!!deleteTargetUser}
        onClose={() => (deleteLoading ? null : setDeleteTargetUser(null))}
        title="Confirm User Deletion"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTargetUser(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              loading={deleteLoading}
              loadingText="Deleting..."
            >
              <Trash2 size={15} /> Delete Account
            </Button>
          </>
        }
      >
        {deleteTargetUser && (
          <div className="space-y-3 text-xs text-ink-soft">
            <p>
              Are you sure you want to delete the account for <strong className="text-ink">{deleteTargetUser.name}</strong> (<span className="font-mono">{deleteTargetUser.email}</span>)?
            </p>
            <p className="text-[11px] text-ink-muted">
              Note: If this user has existing print order history, the account will be safely deactivated to preserve financial records.
            </p>
          </div>
        )}
      </Modal>

      {/* User Profile & Print History Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.user ? `User Details · ${selectedUser.user.name}` : 'User Profile'}
        size="lg"
        footer={
          selectedUser?.user && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {selectedUser.user.id !== currentUser.id && (
                  <>
                    {!selectedUser.user.isActive ? (
                      <button
                        type="button"
                        onClick={() => toggleStatus(selectedUser.user)}
                        className="btn btn-sm bg-green-600 hover:bg-green-700 text-white font-medium inline-flex items-center gap-1.5"
                      >
                        <UserCheck size={15} /> Approve &amp; Activate Account
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleStatus(selectedUser.user)}
                        className="btn btn-sm btn-danger inline-flex items-center gap-1.5"
                      >
                        <UserX size={15} /> Deactivate Account
                      </button>
                    )}
                  </>
                )}
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
                      {selectedUser.user.role === 'ADMIN' ? 'Administrator' : 'User / Student'}
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
                <div className="pt-0.5">
                  {selectedUser.user.isActive ? (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Active Account
                    </span>
                  ) : (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Pending Approval
                    </span>
                  )}
                </div>
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
