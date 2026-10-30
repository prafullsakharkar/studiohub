import type React from 'react';
import { CalendarPage } from '@/modules/scheduling';
import type { Project } from '@/types/production';

interface ProjectCalendarTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/**
 * The project's month: its milestones (filtered by the server) and its events. An event row carries the project's name
 * but not its id (CR-25), so events are matched by name until the row has the id.
 */
export const ProjectCalendarTab: React.FC<ProjectCalendarTabProps> = ({ project }) => <CalendarPage embedded projectId={project.id} projectName={project.name} />;
