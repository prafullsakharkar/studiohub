import { RepositoryFactory, RepositoryBundle } from './factory';
import {
  IProjectRepository,
  ITaskRepository,
  IAssetRepository,
  IShotRepository,
  IAuthRepository,
} from './interfaces';

// Re-export all repository interfaces
export * from './interfaces';

// Re-export config utilities
export * from './config';

// Re-export factory
export * from './factory';
export * from './adapters/rest';

/**
 * Service Registry — REST only.
 * Holds singleton live Django REST repositories.
 */
class RepositoryServiceRegistry {
  private bundle: RepositoryBundle;

  constructor() {
    this.bundle = RepositoryFactory.createAll();
  }

  get project(): IProjectRepository {
    return this.bundle.project;
  }

  get task(): ITaskRepository {
    return this.bundle.task;
  }

  get asset(): IAssetRepository {
    return this.bundle.asset;
  }

  get shot(): IShotRepository {
    return this.bundle.shot;
  }

  get auth(): IAuthRepository {
    return this.bundle.auth;
  }
}

export const repositoryRegistry = new RepositoryServiceRegistry();

/**
 * Repository singletons backed by the live Django REST API.
 * Consumer layers (React hooks, components, stores) import these directly.
 */
export const projectRepository: IProjectRepository = new Proxy({} as IProjectRepository, {
  get(_target, prop) {
    const repo = repositoryRegistry.project;
    const value = (repo as any)[prop];
    return typeof value === 'function' ? value.bind(repo) : value;
  },
});

export const taskRepository: ITaskRepository = new Proxy({} as ITaskRepository, {
  get(_target, prop) {
    const repo = repositoryRegistry.task;
    const value = (repo as any)[prop];
    return typeof value === 'function' ? value.bind(repo) : value;
  },
});

export const assetRepository: IAssetRepository = new Proxy({} as IAssetRepository, {
  get(_target, prop) {
    const repo = repositoryRegistry.asset;
    const value = (repo as any)[prop];
    return typeof value === 'function' ? value.bind(repo) : value;
  },
});

export const shotRepository: IShotRepository = new Proxy({} as IShotRepository, {
  get(_target, prop) {
    const repo = repositoryRegistry.shot;
    const value = (repo as any)[prop];
    return typeof value === 'function' ? value.bind(repo) : value;
  },
});

export const authRepository: IAuthRepository = new Proxy({} as IAuthRepository, {
  get(_target, prop) {
    const repo = repositoryRegistry.auth;
    const value = (repo as any)[prop];
    return typeof value === 'function' ? value.bind(repo) : value;
  },
});
