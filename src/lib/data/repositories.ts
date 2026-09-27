import type {
  AppSettingsRepository,
  BackendDataMaintenance,
  BrewingNoteImageRepository,
  BrewingNotePersistence,
  BrewingNoteRepository,
  CoffeeBeanImageRepository,
  CoffeeBeanPersistence,
  CoffeeBeanRepository,
  CustomEquipmentRepository,
  CustomMethodRepository,
  GrinderRepository,
  ImageMaintenance,
  ImageSourcePayloadValidator,
  LegacySettingsRepository,
  OfflineQueueRepository,
  RoasterRenamePersistence,
} from '@/lib/data/contracts';

/** Backend-neutral singleton set consumed by stores and business code. */
export interface DataRepositories {
  appSettingsRepository: AppSettingsRepository;
  grinderRepository: GrinderRepository;
  customEquipmentRepository: CustomEquipmentRepository;
  customMethodRepository: CustomMethodRepository;
  coffeeBeanRepository: CoffeeBeanRepository;
  brewingNoteRepository: BrewingNoteRepository;
  coffeeBeanImageRepository: CoffeeBeanImageRepository;
  coffeeBeanPersistence: CoffeeBeanPersistence;
  brewingNoteImageRepository: BrewingNoteImageRepository;
  brewingNotePersistence: BrewingNotePersistence;
  offlineQueueRepository: OfflineQueueRepository;
  legacySettingsRepository: LegacySettingsRepository;
  roasterRenamePersistence: RoasterRenamePersistence;
  imageMaintenance: ImageMaintenance;
  imageSourcePayloadValidator: ImageSourcePayloadValidator;
  backendDataMaintenance: BackendDataMaintenance;
}

let configuredRepositories: DataRepositories | null = null;

/** Bind a backend once, before data stores begin loading. */
export function configureRepositories(repositories: DataRepositories): void {
  if (configuredRepositories && configuredRepositories !== repositories) {
    throw new Error('Data repositories have already been configured');
  }

  configuredRepositories = repositories;
}

function requireConfiguredRepositories(): DataRepositories {
  if (!configuredRepositories) {
    throw new Error(
      'Data repositories are not configured; initialize a data runtime before accessing them'
    );
  }

  return configuredRepositories;
}

function createRepositoryProxy<TKey extends keyof DataRepositories>(
  key: TKey
): DataRepositories[TKey] {
  const methodProxies = new Map<PropertyKey, (...args: unknown[]) => unknown>();

  return new Proxy({} as DataRepositories[TKey], {
    get(_target, property) {
      // Repository aliases may capture a method during module evaluation.
      // Defer backend lookup until the method is actually called so importing
      // a consumer never requires an initialized storage runtime.
      if (property === 'then') return undefined;

      let methodProxy = methodProxies.get(property);
      if (!methodProxy) {
        methodProxy = (...args: unknown[]) => {
          const repository = requireConfiguredRepositories()[key];
          const method = Reflect.get(repository, property, repository);
          if (typeof method !== 'function') {
            throw new Error(
              `Repository method "${String(property)}" is not available`
            );
          }

          return Reflect.apply(method, repository, args);
        };
        methodProxies.set(property, methodProxy);
      }

      return methodProxy;
    },
  });
}

// Keep existing synchronous import/call sites stable while allowing the app
// startup path to bind a selected backend before any repository operation.
export const appSettingsRepository = createRepositoryProxy(
  'appSettingsRepository'
);
export const grinderRepository = createRepositoryProxy('grinderRepository');
export const customEquipmentRepository = createRepositoryProxy(
  'customEquipmentRepository'
);
export const customMethodRepository = createRepositoryProxy(
  'customMethodRepository'
);
export const coffeeBeanRepository = createRepositoryProxy(
  'coffeeBeanRepository'
);
export const brewingNoteRepository = createRepositoryProxy(
  'brewingNoteRepository'
);
export const coffeeBeanImageRepository = createRepositoryProxy(
  'coffeeBeanImageRepository'
);
export const coffeeBeanPersistence = createRepositoryProxy(
  'coffeeBeanPersistence'
);
export const brewingNoteImageRepository = createRepositoryProxy(
  'brewingNoteImageRepository'
);
export const brewingNotePersistence = createRepositoryProxy(
  'brewingNotePersistence'
);
export const offlineQueueRepository = createRepositoryProxy(
  'offlineQueueRepository'
);
export const legacySettingsRepository = createRepositoryProxy(
  'legacySettingsRepository'
);
export const roasterRenamePersistence = createRepositoryProxy(
  'roasterRenamePersistence'
);
export const imageMaintenance = createRepositoryProxy('imageMaintenance');
export const imageSourcePayloadValidator = createRepositoryProxy(
  'imageSourcePayloadValidator'
);
export const backendDataMaintenance = createRepositoryProxy(
  'backendDataMaintenance'
);
