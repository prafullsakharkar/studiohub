import {
  IProjectRepository,
  ITaskRepository,
  IAssetRepository,
  IShotRepository,
  IAuthRepository,
  IDeliveryRepository,
  IPublishingRepository,
} from './interfaces';
import {
  RESTProjectAdapter,
  RESTTaskAdapter,
  RESTAssetAdapter,
  RESTShotAdapter,
  RESTAuthAdapter,
  RESTDeliveryAdapter,
  RESTPublishingAdapter,
} from './adapters/rest';

export interface RepositoryBundle {
  project: IProjectRepository;
  task: ITaskRepository;
  asset: IAssetRepository;
  shot: IShotRepository;
  auth: IAuthRepository;
  delivery: IDeliveryRepository;
  publishing: IPublishingRepository;
}

/**
 * Repository Factory — REST only.
 * Always instantiates live Django REST adapters.
 */
export class RepositoryFactory {
  static createProjectRepository(): IProjectRepository {
    return new RESTProjectAdapter();
  }

  static createTaskRepository(): ITaskRepository {
    return new RESTTaskAdapter();
  }

  static createAssetRepository(): IAssetRepository {
    return new RESTAssetAdapter();
  }

  static createShotRepository(): IShotRepository {
    return new RESTShotAdapter();
  }

  static createAuthRepository(): IAuthRepository {
    return new RESTAuthAdapter();
  }

  static createDeliveryRepository(): IDeliveryRepository {
    return new RESTDeliveryAdapter();
  }

  static createPublishingRepository(): IPublishingRepository {
    return new RESTPublishingAdapter();
  }

  /**
   * Instantiate an entire bundle of repositories.
   */
  static createAll(): RepositoryBundle {
    return {
      project: this.createProjectRepository(),
      task: this.createTaskRepository(),
      asset: this.createAssetRepository(),
      shot: this.createShotRepository(),
      auth: this.createAuthRepository(),
      delivery: this.createDeliveryRepository(),
      publishing: this.createPublishingRepository(),
    };
  }
}
