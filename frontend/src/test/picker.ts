import { fireEvent, screen, within } from '@testing-library/react';
import type { Matcher } from '@testing-library/react';

/** The open menu of the picker whose field is `trigger`. */
function menuOf(trigger: HTMLElement): HTMLElement {
  const listId = trigger.getAttribute('aria-controls');
  const list = listId ? document.getElementById(listId) : null;
  if (!list) throw new Error('The picker menu is not open.');
  return list;
}

/**
 * Opens the `EntityPicker` labelled `label` and returns its field and menu. With `search`, types it into the menu's
 * search box first (the picker searches on the server, so a record that is not on the first page needs it).
 */
export async function openPicker(label: Matcher, { search, timeout = 1000 }: { search?: string; timeout?: number } = {}) {
  const trigger = await screen.findByLabelText(label, { selector: 'button' }, { timeout });
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger);
  const menu = menuOf(trigger);
  if (search !== undefined) {
    const box = within(menu.parentElement as HTMLElement).getByRole('combobox');
    fireEvent.change(box, { target: { value: search } });
  }
  return { trigger, menu };
}

/** Chooses `option` in the `EntityPicker` labelled `label` (see `openPicker` for `search`). */
export async function pickEntity(label: Matcher, option: Matcher, opts: { search?: string; timeout?: number } = {}) {
  const { menu } = await openPicker(label, opts);
  fireEvent.click(await within(menu).findByRole('option', { name: option }, { timeout: opts.timeout ?? 1000 }));
}
