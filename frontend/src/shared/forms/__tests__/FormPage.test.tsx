import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormPage } from '../FormPage';

afterEach(cleanup);

const base = { title: 'New client', backTo: '/clients', backLabel: 'Clients', editing: false, onSubmit: vi.fn(), isSubmitting: false, isDirty: false, submitLabel: 'Create client' };
const renderPage = (props: Partial<React.ComponentProps<typeof FormPage>> = {}) =>
  render(
    <MemoryRouter initialEntries={['/clients/new']}>
      <Routes>
        <Route path="/clients/new" element={<FormPage {...base} {...props}><input aria-label="Name" /></FormPage>} />
        <Route path="/clients" element={<div>the list</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('FormPage', () => {
  it('has the department form layout: back button to the list, titled card, Cancel then the primary action', () => {
    renderPage({ description: 'Fill in the details to create a client.' });
    expect(screen.getByRole('link', { name: /Clients/ }).getAttribute('href')).toBe('/clients');
    expect(screen.getByRole('heading', { level: 1, name: 'New client' })).toBeTruthy();
    expect(screen.getByText('Fill in the details to create a client.')).toBeTruthy();
    const form = screen.getByLabelText('Name').closest('form') as HTMLFormElement;
    const footer = within(form).getAllByRole('button').map((b) => b.textContent);
    expect(footer).toEqual(['Cancel', 'Create client']);
    expect(within(form).getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/clients');
  });

  it('shows what the server refused in the banner', () => {
    renderPage({ serverError: { banner: 'That code is taken.', details: [], status: 409 } });
    expect(screen.getByRole('alert').textContent).toContain('That code is taken.');
  });

  it('shows the form only once the record has loaded, and its error otherwise', () => {
    renderPage({ editing: true, title: 'Edit client', loading: { isLoading: true, error: null, onRetry: vi.fn(), entityName: 'client' } });
    expect(screen.queryByLabelText('Name')).toBeNull();
    cleanup();
    renderPage({ loading: { isLoading: false, error: null, onRetry: vi.fn(), entityName: 'client' } });
    expect(screen.getByLabelText('Name')).toBeTruthy();
  });
});

describe('FormPage leave guard', () => {
  const leaveVia = [
    ['the back button', () => fireEvent.click(screen.getByRole('link', { name: /Clients/ }))],
    ['Cancel', () => fireEvent.click(screen.getByRole('link', { name: 'Cancel' }))],
  ] as const;

  it.each(leaveVia)('leaves a clean form by %s straight away', async (_name, leave) => {
    renderPage();
    leave();
    expect(await screen.findByText('the list')).toBeTruthy();
  });

  it.each(leaveVia)('asks before %s throws away typed-in changes: Keep editing stays, Discard goes to the list', async (_name, leave) => {
    renderPage({ isDirty: true });
    leave();
    const ask = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(screen.queryByText('the list')).toBeNull();
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('the list')).toBeNull();

    leave();
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByText('the list')).toBeTruthy();
  });

  it('does not stand in the way of a save that is running', async () => {
    renderPage({ isDirty: true, isSubmitting: true });
    fireEvent.click(screen.getByRole('link', { name: /Clients/ }));
    expect(await screen.findByText('the list')).toBeTruthy();
  });

  it('has the browser warn on reload or tab close only while the form is dirty', () => {
    const dirty = renderPage({ isDirty: true });
    const warned = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(warned);
    expect(warned.defaultPrevented).toBe(true);
    dirty.unmount();
    renderPage();
    const quiet = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);
  });
});
