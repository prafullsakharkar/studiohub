import { DomainPermissionDefinition, AccessRoleTemplate, PermissionDomain } from '@/types/identity';

export const PERMISSION_DOMAINS: PermissionDomain[] = [
  'People',
  'Departments',
  'Teams',
  'Offices',
  'Clients',
  'Vendors',
  'Projects',
  'Editorial',
  'Sequences',
  'Shots',
  'Assets',
  'Tasks',
  'Timelogs',
  'Versions',
  'Reviews',
  'Notes',
  'Deliveries',
  'Publishing',
  'Workflows',
  'Schedule',
  'Resources',
  'Pipeline',
  'Files',
  'Media',
  'Reports',
  'Billing',
  'Settings',
  'Security',
  'Audit',
  'Groups',
  'Search',
  'Testing',
  'Dashboard',
  'Workspace',
  'Automations',
  'Integrations',
  'Analytics',
  'Knowledge',
  'AI',
  'Data Platform',
  'Notifications',
  'Roles',
];

export const DOMAIN_PERMISSIONS_CATALOG: DomainPermissionDefinition[] = [
  // ==========================================
  // 1. PEOPLE DOMAIN
  // ==========================================
  { id: 'dp-people-view', code: 'people.view', name: 'View Crew Roster', domain: 'People', resource: 'people', actionType: 'view', description: 'View crew list, contact cards, and team memberships.', riskLevel: 'Low' },
  { id: 'dp-people-create', code: 'people.create', name: 'Add Crew Member', domain: 'People', resource: 'people', actionType: 'create', description: 'Create internal user profiles and onboarding records.', riskLevel: 'Medium' },
  { id: 'dp-people-update', code: 'people.update', name: 'Update Crew Profile', domain: 'People', resource: 'people', actionType: 'update', description: 'Modify crew member details, contact info, and department tags.', riskLevel: 'Medium' },
  { id: 'dp-people-archive', code: 'people.archive', name: 'Archive Crew Member', domain: 'People', resource: 'people', actionType: 'archive', description: 'Deactivate crew account and archive assignments.', riskLevel: 'High' },
  { id: 'dp-people-restore', code: 'people.restore', name: 'Restore Crew Member', domain: 'People', resource: 'people', actionType: 'restore', description: 'Re-activate archived studio crew member.', riskLevel: 'Medium' },
  { id: 'dp-people-delete', code: 'people.delete', name: 'Delete Crew Member', domain: 'People', resource: 'people', actionType: 'delete', description: 'Purge crew member record from directory.', riskLevel: 'Critical' },
  { id: 'dp-people-assign-role', code: 'people.assign_role', name: 'Assign Crew Role', domain: 'People', resource: 'people', actionType: 'assign', description: 'Grant or revoke roles for studio members.', riskLevel: 'High' },

  // ==========================================
  // 3. CLIENTS DOMAIN
  // ==========================================
  { id: 'dp-client-view', code: 'client.view', name: 'View Clients', domain: 'Clients', resource: 'clients', actionType: 'view', description: 'View studio clients, partner portals, and key contacts.', riskLevel: 'Low' },
  { id: 'dp-client-create', code: 'client.create', name: 'Register Client Account', domain: 'Clients', resource: 'clients', actionType: 'create', description: 'Add new studio client organization account.', riskLevel: 'Medium' },
  { id: 'dp-client-update', code: 'client.update', name: 'Update Client Profile', domain: 'Clients', resource: 'clients', actionType: 'update', description: 'Edit client account details, portal settings, and SLA.', riskLevel: 'Medium' },
  { id: 'dp-client-archive', code: 'client.archive', name: 'Archive Client', domain: 'Clients', resource: 'clients', actionType: 'archive', description: 'Archive client relationship and disable external access.', riskLevel: 'High' },
  { id: 'dp-client-delete', code: 'client.delete', name: 'Delete Client', domain: 'Clients', resource: 'clients', actionType: 'delete', description: 'Purge client organization account.', riskLevel: 'Critical' },
  { id: 'dp-client-manage-users', code: 'client.manage_users', name: 'Manage Client Users', domain: 'Clients', resource: 'clients', actionType: 'special', description: 'Provision client reviewer and viewer logins.', riskLevel: 'High' },

  // ==========================================
  // 4. VENDORS DOMAIN
  // ==========================================
  { id: 'dp-vendor-view', code: 'vendor.view', name: 'View Vendors', domain: 'Vendors', resource: 'vendors', actionType: 'view', description: 'View external vendor studios, contracts, and facilities.', riskLevel: 'Low' },
  { id: 'dp-vendor-create', code: 'vendor.create', name: 'Register Vendor Studio', domain: 'Vendors', resource: 'vendors', actionType: 'create', description: 'Register external VFX/outsourcing studio partner.', riskLevel: 'Medium' },
  { id: 'dp-vendor-update', code: 'vendor.update', name: 'Update Vendor Profile', domain: 'Vendors', resource: 'vendors', actionType: 'update', description: 'Edit vendor company profile, rates, and capabilities.', riskLevel: 'Medium' },
  { id: 'dp-vendor-archive', code: 'vendor.archive', name: 'Archive Vendor', domain: 'Vendors', resource: 'vendors', actionType: 'archive', description: 'Archive vendor studio partner and lock turnover packages.', riskLevel: 'High' },
  { id: 'dp-vendor-delete', code: 'vendor.delete', name: 'Delete Vendor', domain: 'Vendors', resource: 'vendors', actionType: 'delete', description: 'Purge vendor profile from studio database.', riskLevel: 'Critical' },
  { id: 'dp-vendor-manage-users', code: 'vendor.manage_users', name: 'Manage Vendor Users', domain: 'Vendors', resource: 'vendors', actionType: 'special', description: 'Provision vendor artist and manager accounts.', riskLevel: 'High' },

  // ==========================================
  // 5. PROJECTS DOMAIN
  // ==========================================
  { id: 'dp-proj-view', code: 'project.view', name: 'View Projects', domain: 'Projects', resource: 'projects', actionType: 'view', description: 'Access project slate, production overviews, and milestones.', riskLevel: 'Low' },
  { id: 'dp-proj-create', code: 'project.create', name: 'Create Project', domain: 'Projects', resource: 'projects', actionType: 'create', description: 'Initialize new feature film, episodic show, or commercial project.', riskLevel: 'High' },
  { id: 'dp-proj-update', code: 'project.update', name: 'Update Project', domain: 'Projects', resource: 'projects', actionType: 'update', description: 'Modify project metadata, frame rates, color spaces, and targets.', riskLevel: 'Medium' },
  { id: 'dp-proj-archive', code: 'project.archive', name: 'Archive Project', domain: 'Projects', resource: 'projects', actionType: 'archive', description: 'Place completed production project into archived storage.', riskLevel: 'High' },
  { id: 'dp-proj-restore', code: 'project.restore', name: 'Restore Project', domain: 'Projects', resource: 'projects', actionType: 'restore', description: 'Unarchive production project back to active slate.', riskLevel: 'Medium' },
  { id: 'dp-proj-delete', code: 'project.delete', name: 'Delete Project', domain: 'Projects', resource: 'projects', actionType: 'delete', description: 'Permanently remove production project container.', riskLevel: 'Critical' },
  { id: 'dp-proj-manage-members', code: 'project.manage_members', name: 'Manage Project Members', domain: 'Projects', resource: 'projects', actionType: 'special', description: 'Add, remove, and configure project memberships and scopes.', riskLevel: 'High' },
  { id: 'dp-proj-manage-roles', code: 'project.manage_roles', name: 'Manage Project Roles', domain: 'Projects', resource: 'projects', actionType: 'assign', description: 'Assign project-level roles and supervision permissions.', riskLevel: 'High' },

  // ==========================================
  // 6. EDITORIAL DOMAIN
  // ==========================================
  { id: 'dp-edit-view', code: 'editorial.view', name: 'View Editorial Cuts', domain: 'Editorial', resource: 'editorial', actionType: 'view', description: 'Inspect timeline EDL, conform tracks, and cut markers.', riskLevel: 'Low' },
  { id: 'dp-edit-create', code: 'editorial.create', name: 'Import EDL / XML', domain: 'Editorial', resource: 'editorial', actionType: 'create', description: 'Ingest editorial cuts, OTIO timelines, and conform XMLs.', riskLevel: 'Medium' },
  { id: 'dp-edit-update', code: 'editorial.update', name: 'Update Editorial Cut', domain: 'Editorial', resource: 'editorial', actionType: 'update', description: 'Modify sequence cut points, transition handles, and frame offsets.', riskLevel: 'Medium' },
  { id: 'dp-edit-archive', code: 'editorial.archive', name: 'Archive Cut', domain: 'Editorial', resource: 'editorial', actionType: 'archive', description: 'Archive obsolete timeline revisions.', riskLevel: 'Medium' },
  { id: 'dp-edit-delete', code: 'editorial.delete', name: 'Delete Cut', domain: 'Editorial', resource: 'editorial', actionType: 'delete', description: 'Purge editorial cut timeline from project.', riskLevel: 'High' },
  { id: 'dp-edit-publish', code: 'editorial.publish', name: 'Publish Master Cut', domain: 'Editorial', resource: 'editorial', actionType: 'publish', description: 'Publish locked edit and trigger automatic shot cut updates.', riskLevel: 'High' },

  // ==========================================
  // 7. SEQUENCES DOMAIN
  // ==========================================
  { id: 'dp-seq-view', code: 'sequence.view', name: 'View Sequences', domain: 'Sequences', resource: 'sequences', actionType: 'view', description: 'Browse project sequences, act breakdowns, and sequence summaries.', riskLevel: 'Low' },
  { id: 'dp-seq-create', code: 'sequence.create', name: 'Create Sequence', domain: 'Sequences', resource: 'sequences', actionType: 'create', description: 'Create new sequence containers (e.g. SQ010, SEQ_BATTLE).', riskLevel: 'Medium' },
  { id: 'dp-seq-update', code: 'sequence.update', name: 'Update Sequence', domain: 'Sequences', resource: 'sequences', actionType: 'update', description: 'Modify sequence descriptions, supervisors, and schedule targets.', riskLevel: 'Low' },
  { id: 'dp-seq-archive', code: 'sequence.archive', name: 'Archive Sequence', domain: 'Sequences', resource: 'sequences', actionType: 'archive', description: 'Archive completed sequence.', riskLevel: 'Medium' },
  { id: 'dp-seq-delete', code: 'sequence.delete', name: 'Delete Sequence', domain: 'Sequences', resource: 'sequences', actionType: 'delete', description: 'Purge sequence record and unassign all nested shots.', riskLevel: 'High' },

  // ==========================================
  // 8. SHOTS DOMAIN
  // ==========================================
  { id: 'dp-shot-view', code: 'shot.view', name: 'View Shots', domain: 'Shots', resource: 'shots', actionType: 'view', description: 'View shot tracking spreadsheets, thumbnails, and frame ranges.', riskLevel: 'Low' },
  { id: 'dp-shot-create', code: 'shot.create', name: 'Create Shots', domain: 'Shots', resource: 'shots', actionType: 'create', description: 'Initialize shot entries, cut in/out frames, and plate links.', riskLevel: 'Medium' },
  { id: 'dp-shot-update', code: 'shot.update', name: 'Update Shot Data', domain: 'Shots', resource: 'shots', actionType: 'update', description: 'Modify shot status, camera metadata, handles, and supervisor tags.', riskLevel: 'Medium' },
  { id: 'dp-shot-archive', code: 'shot.archive', name: 'Archive Shot', domain: 'Shots', resource: 'shots', actionType: 'archive', description: 'Archive cut or omitted shots.', riskLevel: 'Medium' },
  { id: 'dp-shot-restore', code: 'shot.restore', name: 'Restore Shot', domain: 'Shots', resource: 'shots', actionType: 'restore', description: 'Restore previously omitted or archived shot.', riskLevel: 'Medium' },
  { id: 'dp-shot-delete', code: 'shot.delete', name: 'Delete Shot', domain: 'Shots', resource: 'shots', actionType: 'delete', description: 'Purge shot record from production database.', riskLevel: 'High' },
  { id: 'dp-shot-assign', code: 'shot.assign', name: 'Assign Shot Crew', domain: 'Shots', resource: 'shots', actionType: 'assign', description: 'Assign leads, supervisors, and artists to shot tasks.', riskLevel: 'Low' },
  { id: 'dp-shot-submit', code: 'shot.submit', name: 'Submit Shot for Review', domain: 'Shots', resource: 'shots', actionType: 'submit', description: 'Submit work-in-progress shot to internal dailies session.', riskLevel: 'Low' },

  // ==========================================
  // 9. ASSETS DOMAIN
  // ==========================================
  { id: 'dp-asset-view', code: 'asset.view', name: 'View 3D Assets', domain: 'Assets', resource: 'assets', actionType: 'view', description: 'Browse asset library, USD prim hierarchies, and variants.', riskLevel: 'Low' },
  { id: 'dp-asset-create', code: 'asset.create', name: 'Create 3D Asset', domain: 'Assets', resource: 'assets', actionType: 'create', description: 'Register new USD asset containers, characters, props, and environments.', riskLevel: 'Medium' },
  { id: 'dp-asset-update', code: 'asset.update', name: 'Update Asset Metadata', domain: 'Assets', resource: 'assets', actionType: 'update', description: 'Update asset parameters, LOD specifications, and status.', riskLevel: 'Low' },
  { id: 'dp-asset-archive', code: 'asset.archive', name: 'Archive Asset', domain: 'Assets', resource: 'assets', actionType: 'archive', description: 'Archive deprecated asset models.', riskLevel: 'Medium' },
  { id: 'dp-asset-restore', code: 'asset.restore', name: 'Restore Asset', domain: 'Assets', resource: 'assets', actionType: 'restore', description: 'Unarchive 3D asset model.', riskLevel: 'Low' },
  { id: 'dp-asset-delete', code: 'asset.delete', name: 'Delete Asset', domain: 'Assets', resource: 'assets', actionType: 'delete', description: 'Purge asset item and referenced geometry registries.', riskLevel: 'High' },
  { id: 'dp-asset-publish', code: 'asset.publish', name: 'Publish Master Asset Layer', domain: 'Assets', resource: 'assets', actionType: 'publish', description: 'Promote USD asset layer to production master stage.', riskLevel: 'High' },

  // ==========================================
  // 10. TASKS DOMAIN
  // ==========================================
  { id: 'dp-task-view', code: 'task.view', name: 'View Tasks', domain: 'Tasks', resource: 'tasks', actionType: 'view', description: 'View Kanban task boards, discipline tasks, and progress status.', riskLevel: 'Low' },
  { id: 'dp-task-create', code: 'task.create', name: 'Create Tasks', domain: 'Tasks', resource: 'tasks', actionType: 'create', description: 'Create task breakdowns (Comp, FX, Light, Model, Rig).', riskLevel: 'Low' },
  { id: 'dp-task-update', code: 'task.update', name: 'Update Task Details', domain: 'Tasks', resource: 'tasks', actionType: 'update', description: 'Change task status, log working hours, update bids, and write notes.', riskLevel: 'Low' },
  { id: 'dp-task-archive', code: 'task.archive', name: 'Archive Task', domain: 'Tasks', resource: 'tasks', actionType: 'archive', description: 'Archive obsolete or canceled task items.', riskLevel: 'Low' },
  { id: 'dp-task-delete', code: 'task.delete', name: 'Delete Task', domain: 'Tasks', resource: 'tasks', actionType: 'delete', description: 'Purge task and clear time tracking entries.', riskLevel: 'Medium' },
  { id: 'dp-task-assign', code: 'task.assign', name: 'Assign Task', domain: 'Tasks', resource: 'tasks', actionType: 'assign', description: 'Assign tasks to artists, leads, or vendor partners.', riskLevel: 'Low' },

  // ==========================================
  // 11. VERSIONS DOMAIN
  // ==========================================
  { id: 'dp-ver-view', code: 'version.view', name: 'View Versions', domain: 'Versions', resource: 'versions', actionType: 'view', description: 'Browse render versions, media plates, EXRs, and playblast movies.', riskLevel: 'Low' },
  { id: 'dp-ver-create', code: 'version.create', name: 'Register Version', domain: 'Versions', resource: 'versions', actionType: 'create', description: 'Ingest or render new version file (e.g. v003, v004).', riskLevel: 'Low' },
  { id: 'dp-ver-update', code: 'version.update', name: 'Update Version Metadata', domain: 'Versions', resource: 'versions', actionType: 'update', description: 'Update version notes, color tags, and render farm job tags.', riskLevel: 'Low' },
  { id: 'dp-ver-archive', code: 'version.archive', name: 'Archive Version', domain: 'Versions', resource: 'versions', actionType: 'archive', description: 'Archive intermediate render passes.', riskLevel: 'Low' },
  { id: 'dp-ver-delete', code: 'version.delete', name: 'Delete Version', domain: 'Versions', resource: 'versions', actionType: 'delete', description: 'Purge render version entry from version catalog.', riskLevel: 'High' },
  { id: 'dp-ver-publish', code: 'version.publish', name: 'Publish Master Version', domain: 'Versions', resource: 'versions', actionType: 'publish', description: 'Promote version to approved delivery candidate.', riskLevel: 'High' },

  // ==========================================
  // 12. REVIEWS DOMAIN
  // ==========================================
  { id: 'dp-rev-view', code: 'review.view', name: 'View Review Sessions', domain: 'Reviews', resource: 'reviews', actionType: 'view', description: 'Access dailies screening room, synchronized playback, and playlist items.', riskLevel: 'Low' },
  { id: 'dp-rev-create', code: 'review.create', name: 'Create Review Session', domain: 'Reviews', resource: 'reviews', actionType: 'create', description: 'Assemble review playlists for internal dailies or client reviews.', riskLevel: 'Low' },
  { id: 'dp-rev-update', code: 'review.update', name: 'Update Review Playlist', domain: 'Reviews', resource: 'reviews', actionType: 'update', description: 'Reorder playlist items, edit review session objectives.', riskLevel: 'Low' },
  { id: 'dp-rev-archive', code: 'review.archive', name: 'Archive Review Session', domain: 'Reviews', resource: 'reviews', actionType: 'archive', description: 'Archive historical dailies screening logs.', riskLevel: 'Low' },
  { id: 'dp-rev-delete', code: 'review.delete', name: 'Delete Review Session', domain: 'Reviews', resource: 'reviews', actionType: 'delete', description: 'Purge review playlist.', riskLevel: 'Medium' },
  { id: 'dp-rev-approve', code: 'review.approve', name: 'Approve Dailies Version', domain: 'Reviews', resource: 'reviews', actionType: 'approve', description: 'Submit formal review approval, C-App, or final sign-off.', riskLevel: 'High' },
  { id: 'dp-rev-reject', code: 'review.reject', name: 'Reject / Request Changes', domain: 'Reviews', resource: 'reviews', actionType: 'special', description: 'Flag version as revision required with frame annotations.', riskLevel: 'Medium' },

  // ==========================================
  // 13. DELIVERIES DOMAIN
  // ==========================================
  { id: 'dp-del-view', code: 'delivery.view', name: 'View Deliveries', domain: 'Deliveries', resource: 'deliveries', actionType: 'view', description: 'Inspect client delivery packages, vendor turn-ins, and manifest logs.', riskLevel: 'Low' },
  { id: 'dp-del-create', code: 'delivery.create', name: 'Create Delivery Package', domain: 'Deliveries', resource: 'deliveries', actionType: 'create', description: 'Assemble delivery manifest, checksum verification, and export packet.', riskLevel: 'Medium' },
  { id: 'dp-del-update', code: 'delivery.update', name: 'Update Delivery Package', domain: 'Deliveries', resource: 'deliveries', actionType: 'update', description: 'Modify delivery targets, Aspera/Signiant endpoints, and notes.', riskLevel: 'Medium' },
  { id: 'dp-del-archive', code: 'delivery.archive', name: 'Archive Delivery Record', domain: 'Deliveries', resource: 'deliveries', actionType: 'archive', description: 'Archive completed delivery package history.', riskLevel: 'Low' },
  { id: 'dp-del-delete', code: 'delivery.delete', name: 'Delete Delivery Package', domain: 'Deliveries', resource: 'deliveries', actionType: 'delete', description: 'Purge delivery package manifest from database.', riskLevel: 'High' },
  { id: 'dp-del-submit', code: 'delivery.submit', name: 'Submit Delivery to Client', domain: 'Deliveries', resource: 'deliveries', actionType: 'submit', description: 'Dispatch locked turnover package to client portal or DI facility.', riskLevel: 'High' },
  { id: 'dp-del-approve', code: 'delivery.approve', name: 'Approve Vendor Turn-in', domain: 'Deliveries', resource: 'deliveries', actionType: 'approve', description: 'Formally accept outsourced vendor delivery packet.', riskLevel: 'High' },

  // ==========================================
  // 14. SCHEDULE DOMAIN
  // ==========================================
  { id: 'dp-sch-view', code: 'schedule.view', name: 'View Studio Schedules', domain: 'Schedule', resource: 'schedule', actionType: 'view', description: 'View Gantt milestone timelines, crew allocations, and calendar events.', riskLevel: 'Low' },
  { id: 'dp-sch-create', code: 'schedule.create', name: 'Create Milestone / Event', domain: 'Schedule', resource: 'schedule', actionType: 'create', description: 'Add milestone targets, delivery deadlines, and facility events.', riskLevel: 'Medium' },
  { id: 'dp-sch-update', code: 'schedule.update', name: 'Update Schedule Targets', domain: 'Schedule', resource: 'schedule', actionType: 'update', description: 'Adjust milestone dates, shift Gantt timeline dependencies.', riskLevel: 'Medium' },
  { id: 'dp-sch-archive', code: 'schedule.archive', name: 'Archive Schedule Milestone', domain: 'Schedule', resource: 'schedule', actionType: 'archive', description: 'Archive past milestone tracking item.', riskLevel: 'Low' },
  { id: 'dp-sch-delete', code: 'schedule.delete', name: 'Delete Milestone', domain: 'Schedule', resource: 'schedule', actionType: 'delete', description: 'Purge milestone entry from project timeline.', riskLevel: 'Medium' },
  { id: 'dp-sch-publish', code: 'schedule.publish', name: 'Publish Master Schedule', domain: 'Schedule', resource: 'schedule', actionType: 'publish', description: 'Publish locked show milestones to all department heads.', riskLevel: 'High' },

  // ==========================================
  // 15. PIPELINE DOMAIN
  // ==========================================
  { id: 'dp-pipe-view', code: 'pipeline.view', name: 'View Pipeline Configs', domain: 'Pipeline', resource: 'pipeline', actionType: 'view', description: 'Inspect DCC environments, Rez package graphs, and USD schemas.', riskLevel: 'Low' },
  { id: 'dp-pipe-create', code: 'pipeline.create', name: 'Create Pipeline Step / Hook', domain: 'Pipeline', resource: 'pipeline', actionType: 'create', description: 'Register new Pyblish validator, DCC launcher profile, or farm hook.', riskLevel: 'Medium' },
  { id: 'dp-pipe-update', code: 'pipeline.update', name: 'Update Pipeline Config', domain: 'Pipeline', resource: 'pipeline', actionType: 'update', description: 'Modify OpenColorIO profiles, frame rate presets, and farm queues.', riskLevel: 'High' },
  { id: 'dp-pipe-archive', code: 'pipeline.archive', name: 'Archive Pipeline Hook', domain: 'Pipeline', resource: 'pipeline', actionType: 'archive', description: 'Archive legacy pipeline plugin profile.', riskLevel: 'Low' },
  { id: 'dp-pipe-delete', code: 'pipeline.delete', name: 'Delete Pipeline Hook', domain: 'Pipeline', resource: 'pipeline', actionType: 'delete', description: 'Purge custom pipeline step configuration.', riskLevel: 'High' },
  { id: 'dp-pipe-execute', code: 'pipeline.execute', name: 'Execute Pipeline Jobs', domain: 'Pipeline', resource: 'pipeline', actionType: 'special', description: 'Trigger automated transcodes, USD layer baking, and farm dispatchers.', riskLevel: 'Medium' },

  // ==========================================
  // 16. FILES DOMAIN
  // ==========================================
  { id: 'dp-file-view', code: 'file.view', name: 'Browse Studio SAN / Storage', domain: 'Files', resource: 'files', actionType: 'view', description: 'Browse project directory trees, cloud buckets, and asset files.', riskLevel: 'Low' },
  { id: 'dp-file-create', code: 'file.create', name: 'Create / Upload Files', domain: 'Files', resource: 'files', actionType: 'create', description: 'Upload production files, textures, geometry caches, and documents.', riskLevel: 'Low' },
  { id: 'dp-file-update', code: 'file.update', name: 'Update File Metadata', domain: 'Files', resource: 'files', actionType: 'update', description: 'Update file tagging, access labels, and storage tiers.', riskLevel: 'Low' },
  { id: 'dp-file-archive', code: 'file.archive', name: 'Archive File to Cold Storage', domain: 'Files', resource: 'files', actionType: 'archive', description: 'Transfer large production render passes to deep tape/glacier storage.', riskLevel: 'Medium' },
  { id: 'dp-file-delete', code: 'file.delete', name: 'Delete Files', domain: 'Files', resource: 'files', actionType: 'delete', description: 'Permanently purge raw plates or files from disk.', riskLevel: 'Critical' },
  { id: 'dp-file-download', code: 'file.download', name: 'Download High-Res Media', domain: 'Files', resource: 'files', actionType: 'export', description: 'Download full resolution EXR plates, 3D caches, and audio stems.', riskLevel: 'Medium' },

  // ==========================================
  // 17. SECURITY DOMAIN
  // ==========================================
  { id: 'dp-sec-view', code: 'security.view', name: 'View Security & RBAC', domain: 'Security', resource: 'security', actionType: 'view', description: 'Inspect roles, permissions, group structures, and effective permissions.', riskLevel: 'Low' },
  { id: 'dp-sec-create', code: 'security.create', name: 'Create Roles & Groups', domain: 'Security', resource: 'security', actionType: 'create', description: 'Create custom security roles and access groups.', riskLevel: 'High' },
  { id: 'dp-sec-update', code: 'security.update', name: 'Update Security Policies', domain: 'Security', resource: 'security', actionType: 'update', description: 'Modify role permission grants, group memberships, and security scopes.', riskLevel: 'Critical' },
  { id: 'dp-sec-archive', code: 'security.archive', name: 'Archive Security Role', domain: 'Security', resource: 'security', actionType: 'archive', description: 'Archive obsolete access role or group.', riskLevel: 'High' },
  { id: 'dp-sec-delete', code: 'security.delete', name: 'Delete Security Role', domain: 'Security', resource: 'security', actionType: 'delete', description: 'Permanently remove custom role from system.', riskLevel: 'Critical' },

  // ==========================================
  // 18. DEPARTMENTS DOMAIN
  // ==========================================
  { id: 'dp-dept-view', code: 'department.view', name: 'View Departments', domain: 'Departments', resource: 'department', actionType: 'view', description: 'View department structures, leads, and budget allocation.', riskLevel: 'Low' },
  { id: 'dp-dept-create', code: 'department.create', name: 'Create Department', domain: 'Departments', resource: 'department', actionType: 'create', description: 'Establish new studio craft department.', riskLevel: 'Medium' },
  { id: 'dp-dept-update', code: 'department.update', name: 'Update Department', domain: 'Departments', resource: 'department', actionType: 'update', description: 'Modify department lead, targets, and parameters.', riskLevel: 'Medium' },
  { id: 'dp-dept-archive', code: 'department.archive', name: 'Archive Department', domain: 'Departments', resource: 'department', actionType: 'archive', description: 'Archive department from active studio list.', riskLevel: 'High' },
  { id: 'dp-dept-delete', code: 'department.delete', name: 'Delete Department', domain: 'Departments', resource: 'department', actionType: 'delete', description: 'Permanently remove department entry.', riskLevel: 'Critical' },

  // ==========================================
  // 19. TEAMS DOMAIN
  // ==========================================
  { id: 'dp-team-view', code: 'team.view', name: 'View Creative Teams', domain: 'Teams', resource: 'team', actionType: 'view', description: 'View creative units, pod rosters, and team leaders.', riskLevel: 'Low' },
  { id: 'dp-team-create', code: 'team.create', name: 'Create Team', domain: 'Teams', resource: 'team', actionType: 'create', description: 'Create new production pod or creative unit.', riskLevel: 'Medium' },
  { id: 'dp-team-update', code: 'team.update', name: 'Update Team', domain: 'Teams', resource: 'team', actionType: 'update', description: 'Update team assignments, members, and squad leads.', riskLevel: 'Medium' },
  { id: 'dp-team-archive', code: 'team.archive', name: 'Archive Team', domain: 'Teams', resource: 'team', actionType: 'archive', description: 'Archive creative team.', riskLevel: 'Medium' },
  { id: 'dp-team-delete', code: 'team.delete', name: 'Delete Team', domain: 'Teams', resource: 'team', actionType: 'delete', description: 'Permanently delete creative team unit.', riskLevel: 'High' },

  // ==========================================
  // 20. OFFICES DOMAIN
  // ==========================================
  { id: 'dp-office-view', code: 'office.view', name: 'View Offices & Facilities', domain: 'Offices', resource: 'office', actionType: 'view', description: 'View studio office locations, soundstages, and sites.', riskLevel: 'Low' },
  { id: 'dp-office-create', code: 'office.create', name: 'Create Office Location', domain: 'Offices', resource: 'office', actionType: 'create', description: 'Add new studio branch location or soundstage facility.', riskLevel: 'Medium' },
  { id: 'dp-office-update', code: 'office.update', name: 'Update Office Location', domain: 'Offices', resource: 'office', actionType: 'update', description: 'Edit office timezone, address, and facility configs.', riskLevel: 'Medium' },
  { id: 'dp-office-archive', code: 'office.archive', name: 'Archive Office Location', domain: 'Offices', resource: 'office', actionType: 'archive', description: 'Archive facility site.', riskLevel: 'High' },
  { id: 'dp-office-delete', code: 'office.delete', name: 'Delete Office Location', domain: 'Offices', resource: 'office', actionType: 'delete', description: 'Purge facility site record.', riskLevel: 'Critical' },

  // ==========================================
  // 21. TIMELOGS DOMAIN
  // ==========================================
  { id: 'dp-time-view', code: 'timelog.view', name: 'View Timelogs & Hours', domain: 'Timelogs', resource: 'timelog', actionType: 'view', description: 'View artist time entries, bid vs actuals, and timesheets.', riskLevel: 'Low' },
  { id: 'dp-time-create', code: 'timelog.create', name: 'Log Work Hours', domain: 'Timelogs', resource: 'timelog', actionType: 'create', description: 'Submit work log entries and OT hours on tasks.', riskLevel: 'Low' },
  { id: 'dp-time-update', code: 'timelog.update', name: 'Update Timelog Entry', domain: 'Timelogs', resource: 'timelog', actionType: 'update', description: 'Modify recorded hours, activity codes, and notes.', riskLevel: 'Low' },
  { id: 'dp-time-approve', code: 'timelog.approve', name: 'Approve Timesheets', domain: 'Timelogs', resource: 'timelog', actionType: 'approve', description: 'Supervisor approval on crew work hours and overtime.', riskLevel: 'High' },
  { id: 'dp-time-archive', code: 'timelog.archive', name: 'Archive Timelog', domain: 'Timelogs', resource: 'timelog', actionType: 'archive', description: 'Archive historic time entries.', riskLevel: 'Low' },
  { id: 'dp-time-delete', code: 'timelog.delete', name: 'Delete Timelog', domain: 'Timelogs', resource: 'timelog', actionType: 'delete', description: 'Purge timelog record.', riskLevel: 'High' },
  { id: 'dp-time-export', code: 'timelog.export', name: 'Export Payroll & Timelogs', domain: 'Timelogs', resource: 'timelog', actionType: 'export', description: 'Export labor report CSV for payroll processing.', riskLevel: 'High' },

  // ==========================================
  // 22. NOTES DOMAIN
  // ==========================================
  { id: 'dp-note-view', code: 'note.view', name: 'View Notes & Feedback', domain: 'Notes', resource: 'note', actionType: 'view', description: 'View supervisor notes, director briefs, and feedback threads.', riskLevel: 'Low' },
  { id: 'dp-note-create', code: 'note.create', name: 'Create Note', domain: 'Notes', resource: 'note', actionType: 'create', description: 'Post new note, review comment, or brief.', riskLevel: 'Low' },
  { id: 'dp-note-update', code: 'note.update', name: 'Update Note', domain: 'Notes', resource: 'note', actionType: 'update', description: 'Modify note content and references.', riskLevel: 'Low' },
  { id: 'dp-note-resolve', code: 'note.resolve', name: 'Resolve Note Item', domain: 'Notes', resource: 'note', actionType: 'special', description: 'Mark note thread action items as addressed.', riskLevel: 'Low' },
  { id: 'dp-note-delete', code: 'note.delete', name: 'Delete Note', domain: 'Notes', resource: 'note', actionType: 'delete', description: 'Purge note thread.', riskLevel: 'Medium' },

  // ==========================================
  // 23. PUBLISHING DOMAIN
  // ==========================================
  { id: 'dp-pub-view', code: 'publishing.view', name: 'View Published Assets & Packages', domain: 'Publishing', resource: 'publishing', actionType: 'view', description: 'Browse published USD layers, Alembic caches, and textures.', riskLevel: 'Low' },
  { id: 'dp-pub-create', code: 'publishing.create', name: 'Create Publish Package', domain: 'Publishing', resource: 'publishing', actionType: 'create', description: 'Assemble new publish packet from DCC tools.', riskLevel: 'Medium' },
  { id: 'dp-pub-publish', code: 'publishing.publish', name: 'Publish Master Component', domain: 'Publishing', resource: 'publishing', actionType: 'publish', description: 'Promote publish candidate to show pipeline master.', riskLevel: 'High' },
  { id: 'dp-pub-archive', code: 'publishing.archive', name: 'Archive Publish Package', domain: 'Publishing', resource: 'publishing', actionType: 'archive', description: 'Archive obsolete published assets.', riskLevel: 'Medium' },
  { id: 'dp-pub-delete', code: 'publishing.delete', name: 'Delete Publish Package', domain: 'Publishing', resource: 'publishing', actionType: 'delete', description: 'Purge publish entry from database.', riskLevel: 'High' },

  // ==========================================
  // 24. WORKFLOWS DOMAIN
  // ==========================================
  { id: 'dp-wf-view', code: 'workflow.view', name: 'View Workflows & Automations', domain: 'Workflows', resource: 'workflow', actionType: 'view', description: 'View state transition rules, lifecycle triggers, and status graphs.', riskLevel: 'Low' },
  { id: 'dp-wf-create', code: 'workflow.create', name: 'Create Workflow Schema', domain: 'Workflows', resource: 'workflow', actionType: 'create', description: 'Build custom status pipelines and approval gates.', riskLevel: 'High' },
  { id: 'dp-wf-update', code: 'workflow.update', name: 'Update Workflow Rules', domain: 'Workflows', resource: 'workflow', actionType: 'update', description: 'Modify state machine rules and mandatory sign-offs.', riskLevel: 'High' },
  { id: 'dp-wf-execute', code: 'workflow.execute', name: 'Trigger Workflow Execution', domain: 'Workflows', resource: 'workflow', actionType: 'execute', description: 'Trigger automatic status updates and notification dispatches.', riskLevel: 'Medium' },
  { id: 'dp-wf-archive', code: 'workflow.archive', name: 'Archive Workflow', domain: 'Workflows', resource: 'workflow', actionType: 'archive', description: 'Archive deprecated state machine graph.', riskLevel: 'Medium' },
  { id: 'dp-wf-delete', code: 'workflow.delete', name: 'Delete Workflow', domain: 'Workflows', resource: 'workflow', actionType: 'delete', description: 'Purge custom workflow graph.', riskLevel: 'Critical' },

  // ==========================================
  // 25. RESOURCES DOMAIN
  // ==========================================
  { id: 'dp-res-view', code: 'resource.view', name: 'View Capacity & Allocations', domain: 'Resources', resource: 'resource', actionType: 'view', description: 'View artist utilization, skill matrix, and workstation profiles.', riskLevel: 'Low' },
  { id: 'dp-res-create', code: 'resource.create', name: 'Create Resource Profile', domain: 'Resources', resource: 'resource', actionType: 'create', description: 'Add capacity resource profile or render node pool.', riskLevel: 'Medium' },
  { id: 'dp-res-update', code: 'resource.update', name: 'Update Resource Profile', domain: 'Resources', resource: 'resource', actionType: 'update', description: 'Edit available hours, skill tags, and billing rates.', riskLevel: 'Medium' },
  { id: 'dp-res-assign', code: 'resource.assign', name: 'Book Resource Allocation', domain: 'Resources', resource: 'resource', actionType: 'assign', description: 'Reserve crew capacity for show milestones.', riskLevel: 'Medium' },
  { id: 'dp-res-archive', code: 'resource.archive', name: 'Archive Resource', domain: 'Resources', resource: 'resource', actionType: 'archive', description: 'Archive capacity profile.', riskLevel: 'Low' },
  { id: 'dp-res-delete', code: 'resource.delete', name: 'Delete Resource', domain: 'Resources', resource: 'resource', actionType: 'delete', description: 'Purge resource profile.', riskLevel: 'High' },

  // ==========================================
  // 26. MEDIA DOMAIN
  // ==========================================
  { id: 'dp-med-view', code: 'media.view', name: 'View Media Assets', domain: 'Media', resource: 'media', actionType: 'view', description: 'Access proxy clips, color-graded MOV plates, and audio tracks.', riskLevel: 'Low' },
  { id: 'dp-med-create', code: 'media.create', name: 'Ingest Media', domain: 'Media', resource: 'media', actionType: 'create', description: 'Upload new video clip, audio stem, or camera raw plate.', riskLevel: 'Low' },
  { id: 'dp-med-update', code: 'media.update', name: 'Update Media Metadata', domain: 'Media', resource: 'media', actionType: 'update', description: 'Update color space, frame rate, and aspect ratio flags.', riskLevel: 'Low' },
  { id: 'dp-med-playback', code: 'media.playback', name: 'Stream High-Res Media', domain: 'Media', resource: 'media', actionType: 'playback', description: 'Uncompressed high-bitrate streaming playback.', riskLevel: 'Medium' },
  { id: 'dp-med-archive', code: 'media.archive', name: 'Archive Media', domain: 'Media', resource: 'media', actionType: 'archive', description: 'Send high-res plates to cold tape storage.', riskLevel: 'Medium' },
  { id: 'dp-med-delete', code: 'media.delete', name: 'Delete Media', domain: 'Media', resource: 'media', actionType: 'delete', description: 'Purge media file from server.', riskLevel: 'High' },

  // ==========================================
  // 27. REPORTS DOMAIN
  // ==========================================
  { id: 'dp-rep-view', code: 'reports.view', name: 'View Analytics & Reports', domain: 'Reports', resource: 'reports', actionType: 'view', description: 'Access velocity charts, show progress reports, and quota metrics.', riskLevel: 'Low' },
  { id: 'dp-rep-create', code: 'reports.create', name: 'Generate Custom Report', domain: 'Reports', resource: 'reports', actionType: 'create', description: 'Configure custom analytics query report.', riskLevel: 'Medium' },
  { id: 'dp-rep-export', code: 'reports.export', name: 'Export Executive Reports', domain: 'Reports', resource: 'reports', actionType: 'export', description: 'Download PDF / CSV executive summaries.', riskLevel: 'High' },

  // ==========================================
  // 28. BILLING DOMAIN
  // ==========================================

  // ==========================================
  // 29. SETTINGS DOMAIN
  // ==========================================
  { id: 'dp-set-view', code: 'settings.view', name: 'View Studio Settings', domain: 'Settings', resource: 'settings', actionType: 'view', description: 'View studio branding, defaults, and API keys.', riskLevel: 'Low' },
  { id: 'dp-set-update', code: 'settings.update', name: 'Update Studio Settings', domain: 'Settings', resource: 'settings', actionType: 'update', description: 'Modify tenant configuration, storage mounts, and integrations.', riskLevel: 'Critical' },

  // ==========================================
  // 30. AUDIT DOMAIN
  // ==========================================
  { id: 'dp-aud-view', code: 'audit.view', name: 'View Compliance Audit Trail', domain: 'Audit', resource: 'audit', actionType: 'view', description: 'Inspect system change logs, authentication logs, and data edits.', riskLevel: 'Medium' },
  { id: 'dp-aud-export', code: 'audit.export', name: 'Export Audit Trail', domain: 'Audit', resource: 'audit', actionType: 'export', description: 'Export security event compliance logs.', riskLevel: 'High' },

  // ==========================================
  // 31. GROUPS DOMAIN
  // ==========================================
  { id: 'dp-grp-view', code: 'group.view', name: 'View User Groups', domain: 'Groups', resource: 'group', actionType: 'view', description: 'View user group rosters and role assignments.', riskLevel: 'Low' },
  { id: 'dp-grp-create', code: 'group.create', name: 'Create User Group', domain: 'Groups', resource: 'group', actionType: 'create', description: 'Create user access bundle group.', riskLevel: 'Medium' },
  { id: 'dp-grp-update', code: 'group.update', name: 'Update User Group', domain: 'Groups', resource: 'group', actionType: 'update', description: 'Modify group members and assigned roles.', riskLevel: 'High' },
  { id: 'dp-grp-archive', code: 'group.archive', name: 'Archive User Group', domain: 'Groups', resource: 'group', actionType: 'archive', description: 'Archive access group.', riskLevel: 'Medium' },
  { id: 'dp-grp-delete', code: 'group.delete', name: 'Delete User Group', domain: 'Groups', resource: 'group', actionType: 'delete', description: 'Purge access group.', riskLevel: 'High' },

  // ==========================================
  // 32. SEARCH DOMAIN
  // ==========================================
  { id: 'dp-src-view', code: 'search.view', name: 'Access Universal Search', domain: 'Search', resource: 'search', actionType: 'view', description: 'Access studio global search command palette.', riskLevel: 'Low' },
  { id: 'dp-src-exec', code: 'search.execute', name: 'Execute Deep Queries', domain: 'Search', resource: 'search', actionType: 'execute', description: 'Run cross-project deep search queries.', riskLevel: 'Low' },

  // ==========================================
  // 33. TESTING DOMAIN
  // ==========================================
  { id: 'dp-tst-view', code: 'testing.view', name: 'Access Testing & QA Suite', domain: 'Testing', resource: 'testing', actionType: 'view', description: 'Access system diagnostics and testing utilities.', riskLevel: 'Low' },
  { id: 'dp-tst-exec', code: 'testing.execute', name: 'Execute QA Test Suites', domain: 'Testing', resource: 'testing', actionType: 'execute', description: 'Run system health checks and mock data generation.', riskLevel: 'Medium' },

  // ==========================================
  // 34. DASHBOARD DOMAIN
  // ==========================================
  { id: 'dp-dsh-view', code: 'dashboard.view', name: 'View Studio Dashboard', domain: 'Dashboard', resource: 'dashboard', actionType: 'view', description: 'Access studio executive dashboard, milestones, and high-level summaries.', riskLevel: 'Low' },
  { id: 'dp-dsh-update', code: 'dashboard.update', name: 'Customize Dashboard Layout', domain: 'Dashboard', resource: 'dashboard', actionType: 'update', description: 'Rearrange and configure personal or studio dashboard widgets.', riskLevel: 'Low' },
  { id: 'dp-dsh-export', code: 'dashboard.export', name: 'Export Dashboard Metrics', domain: 'Dashboard', resource: 'dashboard', actionType: 'export', description: 'Export dashboard snapshot summary or data extracts.', riskLevel: 'Low' },

  // ==========================================
  // 35. WORKSPACE DOMAIN
  // ==========================================
  { id: 'dp-wks-view', code: 'workspace.view', name: 'Access Non-Linear Workspace', domain: 'Workspace', resource: 'workspace', actionType: 'view', description: 'Access interactive multi-project canvas and non-linear production workspace.', riskLevel: 'Low' },
  { id: 'dp-wks-create', code: 'workspace.create', name: 'Create Workspace Board', domain: 'Workspace', resource: 'workspace', actionType: 'create', description: 'Create and initialize new non-linear workspaces and node canvases.', riskLevel: 'Medium' },
  { id: 'dp-wks-update', code: 'workspace.update', name: 'Update Workspace Nodes', domain: 'Workspace', resource: 'workspace', actionType: 'update', description: 'Pin views, modify canvas layouts, and organize linked production nodes.', riskLevel: 'Low' },
  { id: 'dp-wks-delete', code: 'workspace.delete', name: 'Delete Workspace Board', domain: 'Workspace', resource: 'workspace', actionType: 'delete', description: 'Remove custom workspace boards and linked canvas definitions.', riskLevel: 'Medium' },

  // ==========================================
  // 41. DATA PLATFORM DOMAIN
  // ==========================================
  { id: 'dp-dtp-view', code: 'data_platform.view', name: 'Access Data Platform', domain: 'Data Platform', resource: 'data_platform', actionType: 'view', description: 'Access universal multi-view data platform across all studio entities.', riskLevel: 'Low' },
  { id: 'dp-dtp-execute', code: 'data_platform.execute', name: 'Execute Dynamic Queries', domain: 'Data Platform', resource: 'data_platform', actionType: 'execute', description: 'Run custom cross-table queries, filter groups, and aggregations.', riskLevel: 'Medium' },
  { id: 'dp-dtp-export', code: 'data_platform.export', name: 'Bulk Export Data Records', domain: 'Data Platform', resource: 'data_platform', actionType: 'export', description: 'Export large studio datasets across any view or custom filter.', riskLevel: 'High' },
  { id: 'dp-dtp-update', code: 'data_platform.update', name: 'Manage Schema Definitions', domain: 'Data Platform', resource: 'data_platform', actionType: 'update', description: 'Define custom entity fields, attribute types, and relation metadata.', riskLevel: 'Critical' },

  // ==========================================
  // 42. NOTIFICATIONS DOMAIN
  // ==========================================
  { id: 'dp-ntf-view', code: 'notifications.view', name: 'View Notifications', domain: 'Notifications', resource: 'notifications', actionType: 'view', description: 'Receive and inspect in-app notifications, task mentions, and review requests.', riskLevel: 'Low' },
  { id: 'dp-ntf-create', code: 'notifications.create', name: 'Broadcast Studio Alerts', domain: 'Notifications', resource: 'notifications', actionType: 'create', description: 'Issue high-priority broadcast alerts across departments or the whole studio.', riskLevel: 'High' },
  { id: 'dp-ntf-update', code: 'notifications.update', name: 'Manage Alert Preferences', domain: 'Notifications', resource: 'notifications', actionType: 'update', description: 'Configure notification routing, Slack channel webhooks, and digest frequencies.', riskLevel: 'Medium' },
  { id: 'dp-ntf-delete', code: 'notifications.delete', name: 'Clear Notification Logs', domain: 'Notifications', resource: 'notifications', actionType: 'delete', description: 'Dismiss and prune historical notification items.', riskLevel: 'Low' },

  // ==========================================
  // 43. ROLES DOMAIN
  // ==========================================
  { id: 'dp-rol-view', code: 'roles.view', name: 'View Enterprise Roles', domain: 'Roles', resource: 'roles', actionType: 'view', description: 'Inspect enterprise RBAC roles, permission assignments, and inheritance graphs.', riskLevel: 'Low' },
  { id: 'dp-rol-create', code: 'roles.create', name: 'Create Custom Role', domain: 'Roles', resource: 'roles', actionType: 'create', description: 'Define new custom enterprise roles with customized access grants.', riskLevel: 'High' },
  { id: 'dp-rol-update', code: 'roles.update', name: 'Update Role Capabilities', domain: 'Roles', resource: 'roles', actionType: 'update', description: 'Modify permission matrix, granted domains, and scope restrictions for roles.', riskLevel: 'Critical' },
  { id: 'dp-rol-assign', code: 'roles.assign', name: 'Assign Role to Users', domain: 'Roles', resource: 'roles', actionType: 'assign', description: 'Assign roles to studio members or department groups.', riskLevel: 'High' },
  { id: 'dp-rol-delete', code: 'roles.delete', name: 'Delete Enterprise Role', domain: 'Roles', resource: 'roles', actionType: 'delete', description: 'Permanently remove custom roles from the studio workspace.', riskLevel: 'Critical' },

  // ==========================================
  // BULK & ADVANCED OPERATIONS CATALOG
  // ==========================================
  { id: 'dp-shot-bulk-create', code: 'shot.bulk_create', name: 'Bulk Create Shots', domain: 'Shots', resource: 'shots', actionType: 'bulk_create', description: 'Batch import and ingest sequences of shots from CSV or EDL conformed cuts.', riskLevel: 'High' },
  { id: 'dp-shot-bulk-update', code: 'shot.bulk_update', name: 'Bulk Update Shots', domain: 'Shots', resource: 'shots', actionType: 'bulk_update', description: 'Batch update status, assignments, or cut lengths across selected shots.', riskLevel: 'High' },
  { id: 'dp-shot-bulk-archive', code: 'shot.bulk_archive', name: 'Bulk Archive Shots', domain: 'Shots', resource: 'shots', actionType: 'bulk_archive', description: 'Move multiple omitted or completed shots to archive.', riskLevel: 'High' },
  { id: 'dp-shot-bulk-delete', code: 'shot.bulk_delete', name: 'Bulk Delete Shots', domain: 'Shots', resource: 'shots', actionType: 'bulk_delete', description: 'Batch purge multiple selected shot records.', riskLevel: 'Critical' },

  { id: 'dp-asset-bulk-create', code: 'asset.bulk_create', name: 'Bulk Create Assets', domain: 'Assets', resource: 'assets', actionType: 'bulk_create', description: 'Batch initialize production asset items from manifest.', riskLevel: 'High' },
  { id: 'dp-asset-bulk-update', code: 'asset.bulk_update', name: 'Bulk Update Assets', domain: 'Assets', resource: 'assets', actionType: 'bulk_update', description: 'Batch update asset categories, status flags, and supervisors.', riskLevel: 'High' },
  { id: 'dp-asset-bulk-archive', code: 'asset.bulk_archive', name: 'Bulk Archive Assets', domain: 'Assets', resource: 'assets', actionType: 'bulk_archive', description: 'Batch archive completed or superseded asset records.', riskLevel: 'High' },
  { id: 'dp-asset-bulk-delete', code: 'asset.bulk_delete', name: 'Bulk Delete Assets', domain: 'Assets', resource: 'assets', actionType: 'bulk_delete', description: 'Batch purge multiple asset items.', riskLevel: 'Critical' },

  { id: 'dp-task-bulk-create', code: 'task.bulk_create', name: 'Bulk Create Tasks', domain: 'Tasks', resource: 'tasks', actionType: 'bulk_create', description: 'Generate standard department tasks across multiple shots or assets simultaneously.', riskLevel: 'High' },
  { id: 'dp-task-bulk-update', code: 'task.bulk_update', name: 'Bulk Update Tasks', domain: 'Tasks', resource: 'tasks', actionType: 'bulk_update', description: 'Batch reassign, re-bid, or change statuses across selected tasks.', riskLevel: 'High' },
  { id: 'dp-task-bulk-archive', code: 'task.bulk_archive', name: 'Bulk Archive Tasks', domain: 'Tasks', resource: 'tasks', actionType: 'bulk_archive', description: 'Archive obsolete or canceled task assignments.', riskLevel: 'High' },
  { id: 'dp-task-bulk-delete', code: 'task.bulk_delete', name: 'Bulk Delete Tasks', domain: 'Tasks', resource: 'tasks', actionType: 'bulk_delete', description: 'Batch purge task records.', riskLevel: 'Critical' },

  { id: 'dp-ver-bulk-update', code: 'version.bulk_update', name: 'Bulk Update Versions', domain: 'Versions', resource: 'versions', actionType: 'bulk_update', description: 'Batch approve, review, or change status on published versions.', riskLevel: 'High' },
  { id: 'dp-ver-import', code: 'version.import', name: 'Import External Versions', domain: 'Versions', resource: 'versions', actionType: 'import', description: 'Ingest packaged turnover directories and vendor versions.', riskLevel: 'Medium' },
  { id: 'dp-ver-export', code: 'version.export', name: 'Export USD/EXR Packages', domain: 'Versions', resource: 'versions', actionType: 'export', description: 'Export version assemblies and media packages to external facilities.', riskLevel: 'High' },

  { id: 'dp-del-bulk-update', code: 'delivery.bulk_update', name: 'Bulk Update Deliveries', domain: 'Deliveries', resource: 'deliveries', actionType: 'bulk_update', description: 'Batch change dispatch status or carrier flags for deliveries.', riskLevel: 'Medium' },
  { id: 'dp-del-export', code: 'delivery.export', name: 'Export Delivery Manifests', domain: 'Deliveries', resource: 'deliveries', actionType: 'export', description: 'Export client turnover manifests and checksum reports.', riskLevel: 'Medium' },
];

export const ACCESS_ROLE_TEMPLATES: AccessRoleTemplate[] = [
  {
    id: 'template-producer',
    name: 'Producer',
    code: 'template_producer',
    description: 'Executive supervision across budgets, milestones, client deliverables, and overall project coordination.',
    category: 'production',
    suggestedScope: 'PROJECT',
    iconName: 'Briefcase',
    defaultPermissions: [
      'project.view', 'project.update', 'project.manage_members',
      'shot.view', 'shot.update', 'shot.assign',
      'asset.view', 'asset.update',
      'task.view', 'task.update', 'task.assign',
      'review.view', 'review.create', 'review.approve',
      'delivery.view', 'delivery.create', 'delivery.submit', 'delivery.approve',
      'schedule.view', 'schedule.update', 'schedule.publish',
      'file.view', 'file.download',
    ],
  },
  {
    id: 'template-prod-manager',
    name: 'Production Manager',
    code: 'template_production_manager',
    description: 'Manages department schedules, dailies rosters, task bids, crew allocations, and vendor turnovers.',
    category: 'production',
    suggestedScope: 'PROJECT',
    iconName: 'ClipboardList',
    defaultPermissions: [
      'project.view',
      'shot.view', 'shot.update', 'shot.assign',
      'asset.view', 'asset.update',
      'task.view', 'task.create', 'task.update', 'task.assign',
      'review.view', 'review.create',
      'delivery.view', 'delivery.create',
      'schedule.view', 'schedule.update',
      'file.view', 'file.download',
    ],
  },
  {
    id: 'template-vfx-sup',
    name: 'VFX Supervisor',
    code: 'template_vfx_supervisor',
    description: 'Creative and visual leadership, shot/asset aesthetic sign-offs, dailies approvals, and client reviews.',
    category: 'production',
    suggestedScope: 'PROJECT',
    iconName: 'Eye',
    defaultPermissions: [
      'project.view',
      'editorial.view',
      'sequence.view', 'sequence.update',
      'shot.view', 'shot.update', 'shot.submit',
      'asset.view', 'asset.update',
      'task.view', 'task.update',
      'version.view', 'version.publish',
      'review.view', 'review.create', 'review.approve', 'review.reject',
      'file.view', 'file.download',
    ],
  },
  {
    id: 'template-artist',
    name: 'Artist',
    code: 'template_artist',
    description: 'Individual craft contributor focused on assigned tasks, version uploads, and dailies submissions.',
    category: 'craft',
    suggestedScope: 'ASSIGNED',
    iconName: 'Palette',
    defaultPermissions: [
      'project.view',
      'shot.view',
      'asset.view',
      'task.view', 'task.update',
      'version.view', 'version.create',
      'review.view',
      'file.view', 'file.create', 'file.download',
    ],
  },
  {
    id: 'template-lead-artist',
    name: 'Lead Artist',
    code: 'template_lead_artist',
    description: 'Discipline squad lead responsible for department quality review, version promotion, and mentoring.',
    category: 'craft',
    suggestedScope: 'TEAM',
    iconName: 'Award',
    defaultPermissions: [
      'project.view',
      'shot.view', 'shot.update',
      'asset.view', 'asset.update', 'asset.publish',
      'task.view', 'task.create', 'task.update', 'task.assign',
      'version.view', 'version.create', 'version.publish',
      'review.view', 'review.create',
      'file.view', 'file.create', 'file.download',
    ],
  },
  {
    id: 'template-vendor-mgr',
    name: 'Vendor Manager',
    code: 'template_vendor_manager',
    description: 'Oversees vendor partner work packages, task bidding, turn-in packages, and artist squad rosters.',
    category: 'vendor',
    suggestedScope: 'VENDOR',
    iconName: 'Building2',
    defaultPermissions: [
      'project.view',
      'shot.view', 'shot.update',
      'asset.view', 'asset.update',
      'task.view', 'task.update', 'task.assign',
      'version.view', 'version.create',
      'review.view', 'review.create',
      'delivery.view', 'delivery.create', 'delivery.submit',
      'file.view', 'file.create', 'file.download',
    ],
  },
  {
    id: 'template-vendor-art',
    name: 'Vendor Artist',
    code: 'template_vendor_artist',
    description: 'Outsourced vendor craft artist working on assigned shots, packages, and version submissions.',
    category: 'vendor',
    suggestedScope: 'VENDOR + ASSIGNED',
    iconName: 'Brush',
    defaultPermissions: [
      'project.view',
      'shot.view',
      'asset.view',
      'task.view', 'task.update',
      'version.view', 'version.create',
      'review.view',
      'file.view', 'file.create',
    ],
  },
  {
    id: 'template-client-rev',
    name: 'Client Reviewer',
    code: 'template_client_reviewer',
    description: 'Client showrunner / VFX supervisor authorized to inspect dailies playlists and approve deliveries.',
    category: 'client',
    suggestedScope: 'CLIENT',
    iconName: 'CheckCircle2',
    defaultPermissions: [
      'project.view',
      'shot.view',
      'asset.view',
      'version.view',
      'review.view', 'review.approve', 'review.reject',
      'delivery.view',
      'file.view', 'file.download',
    ],
  },
  {
    id: 'template-client-view',
    name: 'Client Viewer',
    code: 'template_client_viewer',
    description: 'Read-only screening pass for studio client production executives and stakeholders.',
    category: 'client',
    suggestedScope: 'CLIENT',
    iconName: 'EyeOff',
    defaultPermissions: [
      'project.view',
      'shot.view',
      'asset.view',
      'version.view',
      'review.view',
      'delivery.view',
    ],
  },
  {
    id: 'template-viewer',
    name: 'Viewer',
    code: 'template_viewer',
    description: 'General read-only access to view studio project directories and status without modification rights.',
    category: 'general',
    suggestedScope: 'PROJECT',
    iconName: 'FileText',
    defaultPermissions: [
      'project.view',
      'shot.view',
      'asset.view',
      'task.view',
      'version.view',
      'review.view',
    ],
  },
];
