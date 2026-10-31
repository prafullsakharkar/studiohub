import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

type PropsOf<C> = C extends ComponentType<infer P> ? P : never;

/**
 * A page loaded on first use, from a module that exports it by name (every page here does). Each module becomes
 * its own chunk, so signing in downloads the shell and the page asked for, not the whole application.
 * The component keeps its own props type.
 */
export function lazyNamed<M extends object, K extends keyof M>(load: () => Promise<M>, name: K): LazyExoticComponent<ComponentType<PropsOf<M[K]>>> {
  const page = lazy(async () => ({ default: (await load())[name] as unknown as ComponentType<PropsOf<M[K]>> }));
  // The component's own name, so the route tree and React devtools say which page a route mounts.
  (page as { displayName?: string }).displayName = String(name);
  return page;
}
