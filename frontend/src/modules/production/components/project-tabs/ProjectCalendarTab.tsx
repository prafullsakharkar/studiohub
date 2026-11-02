import type React from 'react';
import { CalendarPage } from '@/modules/scheduling';
import type { Project } from '@/api/production/structure';

interface ProjectCalendarTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's month: its milestones and its events, both filtered by the server (leave is studio-wide and is not shown). */
export const ProjectCalendarTab: React.FC<ProjectCalendarTabProps> = ({ project }) => <CalendarPage embedded projectId={project.id} />;
