export interface PipelineSettings {
  default_fps: number;
  default_color_space: string;
  default_resolution: string;
  usd_schema_version: string;
  ocio_config_path: string;
  farm_engine: 'Deadline' | 'Tractor' | 'OpenCue';
  storage_mount_path: string;
  enable_ai_denoising: boolean;
  enable_auto_transcode: boolean;
  enable_webhooks: boolean;
}

export const mockPipelineSettings: PipelineSettings = {
  default_fps: 24,
  default_color_space: 'ACEScg - ACES 1.3',
  default_resolution: '4096x2160',
  usd_schema_version: 'OpenUSD v24.08',
  ocio_config_path: '/mnt/pipeline/ocio/aces_1.3/config.ocio',
  farm_engine: 'Deadline',
  storage_mount_path: '/mnt/production/storage/apex_vfx',
  enable_ai_denoising: true,
  enable_auto_transcode: true,
  enable_webhooks: true,
};
