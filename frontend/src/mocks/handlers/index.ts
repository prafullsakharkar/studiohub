import { authHandlers } from './authHandlers';
import { projectHandlers } from './projectHandlers';
import { shotHandlers } from './shotHandlers';
import { assetHandlers } from './assetHandlers';
import { taskHandlers } from './taskHandlers';
import { reviewHandlers } from './reviewHandlers';
import { auditHandlers } from './auditHandlers';
import { analyticsHandlers } from './analyticsHandlers';
import { settingsHandlers } from './settingsHandlers';

export const handlers = [
  ...authHandlers,
  ...projectHandlers,
  ...shotHandlers,
  ...assetHandlers,
  ...taskHandlers,
  ...reviewHandlers,
  ...auditHandlers,
  ...analyticsHandlers,
  ...settingsHandlers,
];
