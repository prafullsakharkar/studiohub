import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { ReviewOverview } from '../ReviewOverview';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const mount = (review: unknown) =>
  render(
    <MemoryRouter>
      <ReviewOverview review={review as never} />
    </MemoryRouter>,
  );
afterEach(cleanup);

describe('review overview', () => {
  const review = flow.reviews_approve.body; // Approved, a version, a comment, an annotation with a pin
  const counts = () => within(screen.getByLabelText('Review counts'));
  const tile = (label: string) => counts().getByText(label).nextElementSibling?.textContent;

  it('shows what the review is: its code, what it is for, its status and the supervisor’s verdict', () => {
    mount(review);
    const details = within(screen.getByLabelText('Review details'));
    expect(details.getByText(review.code)).toBeTruthy();
    expect(details.getAllByText('Approved').length).toBeGreaterThanOrEqual(2); // the status, and the verdict it was approved with
    expect(details.getByText(`${review.entity_type} ${review.entity_code}`.trim())).toBeTruthy();
  });

  it('counts the versions, participants, open comments, annotations and notes', () => {
    mount(review);
    expect(tile('Versions')).toBe(String(review.versions.length));
    expect(tile('Participants')).toBe(String(review.reviewers.length));
    expect(tile('Open comments')).toBe(String(review.comments.filter((c: any) => !c.is_resolved).length));
    expect(tile('Annotations')).toBe(String(review.annotations.length));
    expect(tile('Notes')).toBe(String(review.notes.length));
  });

  it('does not count a resolved comment as open, and says how the rest is made up', () => {
    const resolved = { ...review, comments: [{ ...review.comments[0], is_resolved: true, replies: [{ ...review.comments[0], id: 'r1' }] }, { ...review.comments[0], id: 'c2', is_resolved: false, replies: [] }] };
    mount(resolved);
    expect(tile('Open comments')).toBe('1');
    expect(counts().getByText('Open comments').parentElement?.getAttribute('title')).toBe('2 comments, 1 resolved, 1 replies');
  });

  it('tallies the verdicts of the participants and lists them', () => {
    const asked = { ...review, reviewers: [{ ...review.reviewers[0], id: 'p1', name: 'Alex', role: 'Lead', verdict: 'Approved' }, { ...review.reviewers[0], id: 'p2', name: 'Sam', role: '', verdict: 'Retake' }, { ...review.reviewers[0], id: 'p3', name: 'Kim', role: 'Client', verdict: 'Approved' }, { ...review.reviewers[0], id: 'p4', name: 'Lee', role: '', verdict: '' }] };
    mount(asked);
    const tally = within(screen.getByRole('list', { name: 'Verdict tally' }));
    expect(tally.getByText('Approved').closest('li')?.textContent).toContain('2');
    expect(tally.getByText('Retake').closest('li')?.textContent).toContain('1');
    expect(tally.getByText('Pending Review').closest('li')?.textContent).toContain('1'); // no verdict yet is pending
    const people = within(screen.getByRole('list', { name: 'Participants' }));
    expect(people.getAllByRole('listitem')).toHaveLength(4);
    expect(people.getByText('Lead')).toBeTruthy();
  });

  it('says so when nobody has been asked, and when there are no versions or activity', () => {
    mount({ ...review, reviewers: [], versions: [], activity: [] });
    expect(screen.getByText('Nobody has been asked for a verdict yet.')).toBeTruthy();
    expect(screen.getByText('No versions yet.')).toBeTruthy();
    expect(screen.getByText('Nothing has happened on this review yet.')).toBeTruthy();
  });

  it('links each version to its page, in the review’s order', () => {
    const two = { ...review, versions: [{ ...review.versions[0], id: 'v2', code: 'SECOND', order: 1 }, { ...review.versions[0], id: 'v1', code: 'FIRST', order: 0 }] };
    mount(two);
    const list = within(screen.getByRole('list', { name: 'Versions' }));
    const links = list.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['FIRST', 'SECOND']);
    expect(links[0].getAttribute('href')).toBe('/versions/v1');
  });

  it('shows the five latest events, newest first', () => {
    const at = (n: number) => `2026-10-${String(10 + n).padStart(2, '0')}T10:00:00Z`;
    const busy = { ...review, activity: Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, action: `ACTION_${i}`, user: 'someone', notes: '', timestamp: at(i) })) };
    mount(busy);
    const items = within(screen.getByRole('list', { name: 'Latest activity' })).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.map((li) => li.textContent?.match(/ACTION_\d/)?.[0])).toEqual(['ACTION_6', 'ACTION_5', 'ACTION_4', 'ACTION_3', 'ACTION_2']);
  });

  it('counts an annotation that carries a drawing', () => {
    const withDrawing = { ...review, annotations: [{ ...review.annotations[0], drawing_coordinates: { version: 1, shapes: [{ type: 'rect', color: '#ef4444', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }] } }, { ...review.annotations[0], id: 'a2', drawing_coordinates: null }] };
    mount(withDrawing);
    expect(counts().getByText('Annotations').parentElement?.getAttribute('title')).toBe('1 with a drawing');
  });
});
