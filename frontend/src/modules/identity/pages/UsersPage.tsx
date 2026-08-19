import React, { useState, useMemo } from 'react';
import { useFoundationPermissions } from '@/modules/core/hooks/useFoundationPermissions';
import { Can } from '@/core/permissions/Can';
import { Button } from '@/shared/components/Button';
import { Plus, Search, Filter, Download, Upload, Trash2, Edit, Eye } from 'lucide-react';
import { DataTable } from '@/shared/components/DataTable';
import { Card, CardHeader, CardBody, CardFooter } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { mockUsers } from '@/mocks/db/identity/identity';
import { UserStatus } from '@/modules/core/types';

export const UsersPage: React.FC = () => {
    const { canViewUsers, canCreateUsers, canUpdateUsers, canDeleteUsers } = useFoundationPermissions();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<UserStatus | ''>('');
    const [role, setRole] = useState('');
    const [page, setPage] = useState(1);
    const [_pageSize, setPageSize] = useState(20);
    const [_selectedRows, setSelectedRows] = useState<string[]>([]);

    const filteredUsers = useMemo(() => {
        let filtered = [...mockUsers];
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(
                (user) =>
                    user.username.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower) ||
                    user.first_name?.toLowerCase().includes(searchLower) ||
                    user.last_name?.toLowerCase().includes(searchLower)
            );
        }
        if (status) {
            filtered = filtered.filter((user) => user.status === status);
        }
        if (role) {
            filtered = filtered.filter((user) => user.roles.includes(role));
        }
        return filtered;
    }, [search, status, role]);

    const paginatedUsers = useMemo(() => {
        const startIndex = (page - 1) * _pageSize;
        return filteredUsers.slice(startIndex, startIndex + _pageSize);
    }, [filteredUsers, page, _pageSize]);

    const totalCount = filteredUsers.length;

    const columns = [
        {
            id: 'username',
            label: 'Username',
            accessor: 'username' as keyof typeof mockUsers[0],
        },
        {
            id: 'email',
            label: 'Email',
            accessor: 'email' as keyof typeof mockUsers[0],
        },
        {
            id: 'full_name',
            label: 'Full Name',
            accessor: 'full_name' as keyof typeof mockUsers[0],
        },
        {
            id: 'status',
            label: 'Status',
            accessor: 'status' as keyof typeof mockUsers[0],
            cell: (status: UserStatus) => {
                const statusColors: Record<UserStatus, string> = {
                    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    INACTIVE: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                    SUSPENDED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    PENDING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                };
                return <Badge className={statusColors[status] || statusColors.ACTIVE}>{status}</Badge>;
            },
        },
        {
            id: 'roles',
            label: 'Roles',
            accessor: 'roles' as keyof typeof mockUsers[0],
            cell: (roles: string[]) => (
                <div className="flex flex-wrap gap-1">
                    {roles.map((role) => (
                        <Badge key={role} className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                            {role}
                        </Badge>
                    ))}
                </div>
            ),
        },
        {
            id: 'mfa_enabled',
            label: 'MFA',
            accessor: 'mfa_enabled' as keyof typeof mockUsers[0],
            cell: (mfaEnabled: boolean) => (
                <Badge className={mfaEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
                    {mfaEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
            ),
        },
        {
            id: 'actions',
            label: 'Actions',
            accessor: 'id' as keyof typeof mockUsers[0],
            cell: (_id: string) => (
                <div className="flex items-center gap-1">
                    <Can permission="users.update">
                        <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                        </Button>
                    </Can>
                    <Can permission="users.view">
                        <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                        </Button>
                    </Can>
                    <Can permission="users.delete">
                        <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </Can>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Users</h1>
                    <p className="text-slate-400 text-sm">Manage users and their permissions</p>
                </div>
                <Can permission="users.create">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </Can>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Users List</h2>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as UserStatus | '')}
                            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                        </select>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="producer">Producer</option>
                            <option value="artist">Artist</option>
                            <option value="viewer">Viewer</option>
                        </select>
                        <Button variant="outline" size="sm">
                            <Filter className="w-4 h-4 mr-2" />
                            Filter
                        </Button>
                        <Can permission="audit.export">
                            <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </Can>
                        <Can permission="audit.export">
                            <Button variant="outline" size="sm">
                                <Upload className="w-4 h-4 mr-2" />
                                Import
                            </Button>
                        </Can>
                    </div>
                    <DataTable
                        data={paginatedUsers}
                        columns={columns}
                        isLoading={false}
                        totalCount={totalCount}
                        currentPage={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        rowIdKey="id"
                        selectable
                        showColumnToggle
                        showRefresh
                        showExport
                        showPagination
                    />
                </CardBody>
                <CardFooter>
                    <div className="text-sm text-slate-400">
                        Showing {paginatedUsers.length} of {totalCount} users
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};
