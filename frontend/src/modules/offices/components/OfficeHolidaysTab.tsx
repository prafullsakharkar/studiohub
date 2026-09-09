import React from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Office, HolidaySchedule } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

const defaultHolidays: HolidaySchedule[] = [
    { name: 'New Year', date: '2026-01-01', type: 'National' },
    { name: 'Studio Summer Closure', date: '2026-07-20', type: 'Studio Holiday' },
    { name: 'Render Farm Maintenance', date: '2026-09-14', type: 'Maintenance Closure' },
    { name: 'Diwali', date: '2026-11-08', type: 'National' },
];

const typeVariant: Record<HolidaySchedule['type'], 'outline' | 'success' | 'warning'> = {
    'National': 'outline',
    'Studio Holiday': 'success',
    'Maintenance Closure': 'warning',
};

export const OfficeHolidaysTab: React.FC<{ office: Office }> = ({ office }) => {
    const holidays = office.holidays || defaultHolidays;

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-400" />
                        Holiday & Closure Schedule
                    </h3>
                    <p className="text-xs text-slate-400">
                        National holidays, studio closures, and maintenance windows at {office.name}.
                    </p>
                </div>

                <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                    Add Holiday
                </Button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
                        <tr>
                            <th className="py-3 px-4">Holiday</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Type</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                        {holidays.map((holiday) => (
                            <tr key={holiday.name} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-3 px-4 font-bold text-white">{holiday.name}</td>
                                <td className="py-3 px-4 font-mono text-indigo-300">{holiday.date}</td>
                                <td className="py-3 px-4">
                                    <Badge variant={typeVariant[holiday.type]} className="text-[10px] font-mono">
                                        {holiday.type}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
