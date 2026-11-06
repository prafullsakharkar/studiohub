import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, inputClass } from '../FormParts';
import { FormActions } from '../FormActions';
import { FormDialog, formDialogCopy } from '../FormDialog';
import { useServerForm } from '../useServerForm';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

type Values = { name: string };

function Harness({ onClose = vi.fn(), save = vi.fn().mockResolvedValue(undefined) }: { onClose?: () => void; save?: (v: Values) => Promise<unknown> }) {
  const {
    register,
    submit,
    serverError,
    formState: { isSubmitting, isDirty },
  } = useServerForm<Values>({ defaultValues: { name: '' } });
  return (
    <FormDialog title="New thing" onClose={onClose} isSubmitting={isSubmitting} isDirty={isDirty} serverError={serverError} submitLabel="Create thing" onSubmit={submit(async (v) => { await save(v); onClose(); })}>
      <Field id="n" label="Name">
        <input id="n" className={inputClass()} {...register('name')} />
      </Field>
    </FormDialog>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'New thing' });
const type = (value: string) => fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value } });

describe('formDialogCopy', () => {
  it('words create and edit the same way for every entity', () => {
    expect(formDialogCopy('task type', false)).toEqual({ title: 'New task type', submitLabel: 'Create task type', saved: 'Task type created.' });
    expect(formDialogCopy('task type', true)).toEqual({ title: 'Edit task type', submitLabel: 'Save changes', saved: 'Task type saved.' });
  });
});

describe('FormDialog', () => {
  it('starts focus on the first field, not on the close button', async () => {
    render(<Harness />);
    await waitFor(() => expect(document.activeElement).toBe(within(dialog()).getByLabelText('Name')));
  });

  it('closes a clean form straight away (Cancel, X, Escape)', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close dialog' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it.each([
    ['Cancel', () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))],
    ['X', () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Close dialog' }))],
    ['Escape', () => fireEvent.keyDown(within(dialog()).getByLabelText('Name'), { key: 'Escape' })],
  ])('asks before %s throws away typed-in changes; Keep editing stays, Discard leaves', async (_name, close) => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    type('abc');
    close();
    const ask = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull());
    expect((within(dialog()).getByLabelText('Name') as HTMLInputElement).value).toBe('abc');

    close();
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('a save closes without asking, and cannot be interrupted while it runs', async () => {
    const onClose = vi.fn();
    let finish: () => void = () => undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Harness onClose={onClose} save={save} />);
    type('abc');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Create thing' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    // pending: Cancel and the submit are disabled, X and Escape do nothing, a second submit is not sent
    expect((within(dialog()).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog()).getByRole('button', { name: /Create thing/ }) as HTMLButtonElement).disabled).toBe(true);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50)); // let a (wrongly) opened guard render before asserting it is absent
    const noGuard = () => expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close dialog' }));
    await settle();
    noGuard();
    fireEvent.keyDown(within(dialog()).getByLabelText('Name'), { key: 'Escape' });
    await settle();
    noGuard();
    fireEvent.submit(dialog().querySelector('form') as HTMLFormElement);
    expect(onClose).not.toHaveBeenCalled();

    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  });

  it('shows what the server refused in the banner and stays open', async () => {
    const onClose = vi.fn();
    const save = vi.fn().mockRejectedValue(Object.assign(new Error('Nope'), { status: 409, message: 'That name is taken.' }));
    render(<Harness onClose={onClose} save={save} />);
    type('abc');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Create thing' }));
    expect((await within(dialog()).findByRole('alert')).textContent).toContain('That name is taken.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('FormActions', () => {
  it('page layout: Cancel links back, the primary action is last and carries the save icon', () => {
    render(
      <MemoryRouter>
        <FormActions layout="page" submitLabel="Save changes" isSubmitting={false} cancelTo="/things" />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/things');
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Cancel', 'Save changes']);
    expect((buttons[1] as HTMLButtonElement).type).toBe('submit');
  });
});
