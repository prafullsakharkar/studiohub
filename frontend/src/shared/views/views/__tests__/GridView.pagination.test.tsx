import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GridView } from '@/shared/views/views/GridView';

const fields = [{ key: 'name', label: 'Name' }];
const items = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

describe('GridView pagination', () => {
  it('renders no pager without totalCount', () => {
    const { container } = render(<GridView data={items} fields={fields} />);
    expect(container.textContent).toContain('Alpha');
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
  });

  it('renders a working pager with totalCount and notifies page changes', () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <GridView
        data={items}
        fields={fields}
        page={1}
        totalCount={50}
        pageSize={2}
        onPageChange={onPageChange}
      />,
    );
    expect(container.textContent).toContain('Showing');
    expect(container.textContent).toContain('of');
    expect(container.textContent).toContain('50');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('activates cards via keyboard', () => {
    const onCardClick = vi.fn();
    render(<GridView data={items} fields={fields} onCardClick={onCardClick} />);
    const card = screen.getByRole('button', { name: 'Alpha' });
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('activates custom renderCard wrappers via keyboard exactly once', () => {
    const onCardClick = vi.fn();
    render(
      <GridView
        data={items}
        fields={fields}
        onCardClick={onCardClick}
        renderCard={(item: any) => (
          <div onClick={() => onCardClick({ ...item, via: 'inner' })}>{item.name}</div>
        )}
      />,
    );
    const wrapper = screen.getByRole('button', { name: 'Alpha' });
    wrapper.focus();
    fireEvent.keyDown(wrapper, { key: 'Enter' });
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });
});
