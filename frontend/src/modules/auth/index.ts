// Public boundary for the auth module.
// External code imports from '@/modules/auth', never deep paths.
export { useAuth } from './hooks/useAuth';
export type { LoginFormData } from './schemas/authSchemas';
export { authService } from './services/AuthService';
export { LoginPage } from './pages/LoginPage';
export { ForgotPasswordPage } from './pages/ForgotPasswordPage';
export { ResetPasswordPage } from './pages/ResetPasswordPage';
export { ChangePasswordPage } from './pages/ChangePasswordPage';
export { shouldForcePasswordChange } from './utils/passwordChangeGuard';
