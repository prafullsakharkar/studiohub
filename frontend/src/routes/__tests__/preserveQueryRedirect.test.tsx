import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PreserveQueryRedirect } from '@/routes/PreserveQueryRedirect';

function ShowLocation() {
  const { pathname, search } = useLocation();
  return <div>{`${pathname}${search}`}</div>;
}

describe('PreserveQueryRedirect', () => {
  it('preserves search params across redirect', () => {
    render(
      <MemoryRouter initialEntries={['/api-health?category=api&status=degraded']}>
        <Routes>
          <Route path="/api-health" element={<PreserveQueryRedirect to="/platform/health" />} />
          <Route path="/platform/health" element={<ShowLocation />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('/platform/health?category=api&status=degraded')).toBeTruthy();
  });
});
