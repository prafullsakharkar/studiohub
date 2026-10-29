import type React from 'react';
import { Navigate } from 'react-router-dom';

/** Login history is an identity ledger: it lives with the security log (the old audit path did not exist). */
export const LoginHistoryPage: React.FC = () => <Navigate to="/access/security" replace />;
