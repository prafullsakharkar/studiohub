import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormPage } from '../FormPage';

afterEach(cleanup);

const base = { title: 'New client', backTo: '/clients', backLabel: 'Clients', editing: false, onSubmit: vi.fn(), isSubmitting: false, submitLabel: 'Create client' };
const renderPage = (props: Partial<React.ComponentProps<typeof FormPage>> = {}) =>
  render(
    <MemoryRouter>
      <FormPage {...base} {...props}>
        <input aria-label="Name" />
      </FormPage>
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
