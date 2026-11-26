import { peopleApi } from '@/api/masterdata/directory';
import { personLinkApi, usersApi } from '@/api/identity/users';
import { fetchAllRows } from '@/shared/data/listing';

/**
 * The directory person linked to the login `email`, created and linked when there is none: the members panel adds people,
 * not addresses, and the live seed's users have no person. Needs a caller who manages the directory (the manager does).
 */
export async function personFor(email: string, name: string): Promise<{ id: string; name: string; user: string }> {
  const user = (await fetchAllRows(usersApi.list, { email })).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`no login ${email} on the live backend`);
  const linked = (await fetchAllRows(peopleApi.list, {})).find((p) => p.user === user.id);
  if (linked) return { id: linked.id, name: linked.full_name || linked.name, user: user.id };
  const person = await peopleApi.create({ name, status: 'active' } as never);
  await personLinkApi.link(person.id, user.id, true);
  return { id: person.id, name, user: user.id };
}
