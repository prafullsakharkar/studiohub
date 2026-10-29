import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/** Redirect to a canonical path while preserving ?search and #hash. */
export const PreserveQueryRedirect: React.FC<{ to: string }> = ({ to }) => {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
};
