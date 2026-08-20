import React from 'react';
import { Users, Mail, MapPin, ExternalLink, Plus, UserMinus } from 'lucide-react';
import { Team } from '@/types/organization';
import { usePeople } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const TeamMembersTab: React.FC<{
    team: Team;
    onRemoveMember?: (personId: string) => void;
}> = ({ team, onRemoveMember }) => {
    const { data: peopleData } = usePeople();
    const people = (peopleData?.results || []).filter(
        (p) => p.team_id === team.id || p.team_name === team.name
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Squad Roster & Active Members
                    </h3>
                    <p className="text-xs text-slate-400">
                        Artists and technical crew assigned to {team.name}.
                    </p>
                </div>

                <Link to="/people/new">
                    <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                        Add Member
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {people.length === 0 ? (
                    <div className="col-span-3 p-8 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                        No members assigned to this squad yet.
                    </div>
                ) : (
                    people.map((person) => (
                        <div
                            key={person.id}
                            className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <img
                                    src={person.avatar_url}
                                    alt=""
                                    className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700"
                                />
                                <div>
                                    <h4 className="font-bold text-sm text-white">{person.full_name}</h4>
                                    <p className="text-xs text-slate-400">{person.role}</p>
                                </div>
                            </div>

                            <div className="space-y-1 text-xs text-slate-400 font-mono text-[11px]">
                                <div className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="truncate">{person.email}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>{person.office_name}</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400">
                                    {person.availability_status}
                                </Badge>
                                <div className="flex items-center gap-1">
                                    <Link to={`/people/${person.id}`}>
                                        <Button size="xs" variant="outline" rightIcon={<ExternalLink className="w-3 h-3" />}>
                                            Profile
                                        </Button>
                                    </Link>
                                    {onRemoveMember && (
                                        <Button
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => onRemoveMember(person.id)}
                                            className="text-rose-400 hover:text-rose-300"
                                        >
                                            <UserMinus className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
