import React, { useState, useMemo, useEffect } from 'react';
import { useFoundationPermissions } from '@/modules/core/hooks/useFoundationPermissions';
import { Can } from '@/core/permissions/Can';
import { Button } from '@/shared/components/Button';
import { Plus, Search, Filter, Download, Upload, Trash2, Edit, Eye, Shield, Key } from 'lucide-react';
import { DataTable } from '@/shared/components/DataTable';
import { Card, CardHeader, CardBody, CardFooter } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { roleService } from '@/modules/identity/api/RoleService';

interface TableRole {
    id: string;
    name: string;
    description: string;
    user_count: number;
    permission_count: number;
    is_system: boolean;
}

function toTableRole(raw: Record<string, any>): TableRole {
    return {
        id: raw.id ?? raw.uuid,
        name: raw.name ?? '',
        description: raw.description ?? '',
        user_count: raw.user_count ?? 0,
        permission_count: raw.permission_count ?? 0,
        is_system: !!raw.is_system,
    };
}

function extractRoles(data: any): TableRole[] {
    const list = Array.isArray(data) ? data : data?.results ?? [];
    return (list as any[]).map(toTableRole);
}

export const RolesPage: React.FC = () => {
    const { canViewRoles, canCreateRoles, canUpdateRoles, canDeleteRoles } = useFoundationPermissions();
    const [search, setSearch] = useState('');
    const [isSystem, setIsSystem] = useState<boolean | ''>('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [allRoles, setAllRoles] = useState<TableRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        roleService
            .getRoles({ page_size: 200 })
            .then((data) => {
                if (mounted) setAllRoles(extractRoles(data));
            })
            .catch((err) => {
                console.error('[RolesPage] Failed to load roles:', err);
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const filteredRoles = useMemo(() => {
        let filtered = [...allRoles];
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(
                (role) =>
                    role.name.toLowerCase().includes(searchLower) ||
                    role.description.toLowerCase().includes(searchLower)
            );
        }
        if (isSystem !== '') {
            filtered = filtered.filter((role) => role.is_system === isSystem);
        }
        return filtered;
    }, [search, isSystem, allRoles]);

    const paginatedRoles = useMemo(() => {
        const startIndex = (page - 1) * pageSize;
        return filteredRoles.slice(startIndex, startIndex + pageSize);
    }, [filteredRoles, page, pageSize]);

    const totalCount = filteredRoles.length;

    const columns = [
        {
            id: 'name',
            label: 'Role Name',
            accessor: 'name' as keyof TableRole,
            cell: (name: string, role: TableRole) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Shield className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-100">{name}</div>
                        <div className="text-xs text-slate-400">{role.description}</div>
                    </div>
                </div>
            ),
        },
        {
            id: 'user_count',
            label: 'Users',
            accessor: 'user_count' as keyof TableRole,
            cell: (count: number) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300">
                        <span className="text-xs font-medium">{count}</span>
                    </div>
                    <span className="text-sm text-slate-300">users</span>
                </div>
            ),
        },
        {
            id: 'permissions_count',
            label: 'Permissions',
            accessor: 'permission_count' as keyof TableRole,
            cell: (count: number) => {
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <Key className="h-4 w-4" />
                        </div>
                        <span className="text-sm text-slate-300">{count} permissions</span>
                    </div>
                );
            },
        },
        {
            id: 'is_system',
            label: 'Type',
            accessor: 'is_system' as keyof TableRole,
            cell: (isSystem: boolean) => (
                <Badge className={isSystem ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
                    {isSystem ? 'System' : 'Custom'}
                </Badge>
            ),
        },
    ];

    const renderRowActions = (role: TableRole) => (
        <div className="flex items-center gap-2">
            <Can permission="roles.view">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Eye className="h-4 w-4" />
                </Button>
            </Can>
            <Can permission="roles.update">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                </Button>
            </Can>
            <Can permission="roles.delete">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </Can>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Roles</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage user roles and their permissions</p>
                </div>
                <div className="flex items-center gap-2">
                    <Can permission="roles.create">
                        <Button variant="primary" className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Create Role
                        </Button>
                    </Can>
                </div>
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="border-b border-slate-800/50">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search roles..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                />
                            </div>
                            <div className="relative w-40">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <select
                                    value={isSystem === '' ? '' : isSystem ? 'true' : 'false'}
                                    onChange={(e) => setIsSystem(e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none"
                                >
                                    <option value="">All Types</option>
                                    <option value="true">System</option>
                                    <option value="false">Custom</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Can permission="roles.view">
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                    <Download className="h-4 w-4" />
                                    Export
                                </Button>
                            </Can>
                            <Can permission="roles.view">
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    Import
                                </Button>
                            </Can>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="p-0">
                    <DataTable
                        columns={columns}
                        data={paginatedRoles}
                        rowIdKey="id"
                        totalCount={totalCount}
                        currentPage={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onRowClick={(role) => console.log('Row clicked:', role)}
                        renderRowActions={renderRowActions}
                        selectable={canDeleteRoles()}
                        selectedRows={selectedRows}
                        onSelectionChange={(ids) => setSelectedRows(ids as string[])}
                        showPagination={true}
                        showFilters={true}
                        showColumnToggle={true}
                        showRefresh={true}
                        showExport={true}
                        isLoading={isLoading}
                        error={null}
                    />
                </CardBody>
                <CardFooter className="border-t border-slate-800/50 bg-slate-950/30 px-6 py-4">
                    <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-slate-400">
                            Showing {Math.min((page - 1) * pageSize + 1, totalCount)} to {Math.min(page * pageSize, totalCount)} of {totalCount} roles
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1"
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(Math.min(Math.ceil(totalCount / pageSize), page + 1))}
                                    disabled={page === Math.ceil(totalCount / pageSize)}
                                    className="px-3 py-1"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default RolesPage;
