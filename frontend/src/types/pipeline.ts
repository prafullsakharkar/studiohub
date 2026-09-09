export type DCCSoftware =
  | 'Nuke'
  | 'Maya'
  | 'Houdini'
  | 'Blender'
  | 'Unreal'
  | 'USD'
  | 'Custom Studio Pipeline';

export type PipelineStage = 'Project' | 'Task' | 'Publish' | 'Version' | 'Delivery';

export interface DCCConnector {
  id: string;
  name: DCCSoftware;
  icon_name: string;
  version: string;
  status: 'Ready' | 'Connected' | 'Pending Setup' | 'Legacy';
  description: string;
  supported_formats: string[];
  launch_command: string;
  script_template: string;
  pyblish_plugins: string[];
  export_targets: string[];
  usd_schemas: string[];
}

export interface PipelineStepConnection {
  from: PipelineStage;
  to: PipelineStage;
  description: string;
  validation_hook: string;
  automation_active: boolean;
}

export interface PipelineStageInfo {
  stage: PipelineStage;
  title: string;
  description: string;
  active_count: number;
  icon: string;
  accent_color: string;
}
