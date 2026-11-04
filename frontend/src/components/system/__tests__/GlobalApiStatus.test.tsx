import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/api/errors/ApiError';
import { centralErrorHandler } from '@/core/api/error-handler';
import { GlobalApiStatus } from '../GlobalApiStatus';

const LOST = /Connection Lost/;
const networkFailure = () => ApiError.fromUnknown(new TypeError('Failed to fetch'));
const fail = () => act(() => centralErrorHandler.handleError(networkFailure(), { silent: true, source: 'status' }));

afterEach(() => {
  cleanup();
  centralErrorHandler.recordSuccess();
});

describe('GlobalApiStatus', () => {
  it('turns the failure into a NETWORK error (the premise of the other tests)', () => {
    expect(networkFailure().type).toBe('NETWORK');
  });

  it('shows nothing while requests work', () => {
    render(<GlobalApiStatus />);
    expect(screen.queryByText(LOST)).toBeNull();
  });

  it('stays quiet after one failed request and shows the banner after two in a row', () => {
    render(<GlobalApiStatus />);
    fail();
    expect(screen.queryByText(LOST)).toBeNull();
    fail();
    expect(screen.getByText(LOST)).toBeTruthy();
  });

  it('goes away as soon as a request gets through, without a reload', () => {
    render(<GlobalApiStatus />);
    fail();
    fail();
    expect(screen.getByText(LOST)).toBeTruthy();
    act(() => centralErrorHandler.recordSuccess());
    expect(screen.queryByText(LOST)).toBeNull();
  });

  it('counts again from zero after a success', () => {
    render(<GlobalApiStatus />);
    fail();
    act(() => centralErrorHandler.recordSuccess());
    fail();
    expect(screen.queryByText(LOST)).toBeNull();
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<GlobalApiStatus />);
    unmount();
    fail();
    fail();
    expect(() => centralErrorHandler.recordSuccess()).not.toThrow();
  });
});
