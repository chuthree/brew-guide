import type { BusinessChange } from './types';

/** Re-read current records: recovery must never republish stale receipt snapshots. */
export async function publishBusinessChanges(
  changes: BusinessChange[]
): Promise<void> {
  if (!changes.length) return;
  const repositories = await import('@/lib/data/repositories');
  const emit = (name: string, detail: unknown) => {
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent(name, { detail }));
  };
  const entities = new Set(changes.map(change => change.entity));
  if (entities.has('grinder') || entities.has('settings')) {
    const { markSettingsDirty } =
      await import('@/lib/supabase/realtime/settingsDirty');
    if (!markSettingsDirty())
      throw new Error('Settings sync intent cannot be persisted yet.');
  }
  if (entities.has('bean')) {
    const { useCoffeeBeanStore } = await import('@/lib/stores/coffeeBeanStore');
    const beans = await repositories.coffeeBeanRepository.list();
    useCoffeeBeanStore.getState().setBeans(beans);
    for (const change of changes.filter(change => change.entity === 'bean')) {
      const current = beans.find(bean => bean.id === change.id);
      const bean = current
        ? await repositories.coffeeBeanImageRepository.mergeBean(current)
        : undefined;
      emit('coffeeBeanDataChanged', {
        action: current ? (change.before ? 'update' : 'create') : 'delete',
        beanId: change.id,
        bean,
        source: 'local',
      });
    }
  }
  if (entities.has('brew_note')) {
    const { useBrewingNoteStore } =
      await import('@/lib/stores/brewingNoteStore');
    const notes = await repositories.brewingNoteRepository.list();
    useBrewingNoteStore.getState().setNotes(notes);
    for (const change of changes.filter(
      change => change.entity === 'brew_note'
    )) {
      const current = notes.find(note => note.id === change.id);
      const note = current
        ? await repositories.brewingNoteImageRepository.mergeNote(current)
        : undefined;
      emit('brewingNoteDataChanged', {
        action: current ? (change.before ? 'update' : 'create') : 'delete',
        noteId: change.id,
        note,
        source: 'local',
      });
    }
  }
  if (entities.has('equipment')) {
    const { useCustomEquipmentStore } =
      await import('@/lib/stores/customEquipmentStore');
    const equipments = await repositories.customEquipmentRepository.list();
    useCustomEquipmentStore.getState().setEquipments(equipments);
    for (const change of changes.filter(
      change => change.entity === 'equipment'
    )) {
      const equipment = equipments.find(
        equipment => equipment.id === change.id
      );
      emit('customEquipmentDataChanged', {
        action: equipment ? (change.before ? 'update' : 'create') : 'delete',
        equipmentId: change.id,
        equipment,
        source: 'local',
      });
    }
  }
  if (entities.has('method')) {
    const { useCustomMethodStore } =
      await import('@/lib/stores/customMethodStore');
    const rows = await repositories.customMethodRepository.list();
    useCustomMethodStore.setState({
      methodsByEquipment: Object.fromEntries(
        rows.map(row => [row.equipmentId, row.methods])
      ),
      initialized: true,
      error: null,
    });
    for (const change of changes.filter(change => change.entity === 'method')) {
      const methods =
        rows.find(row => row.equipmentId === change.id)?.methods ?? [];
      emit('customMethodDataChanged', {
        action: methods.length ? 'set' : 'delete',
        equipmentId: change.id,
        methods,
        source: 'local',
      });
      emit('customMethodsChanged', { equipmentId: change.id });
    }
  }
  if (entities.has('grinder')) {
    const { useGrinderStore } = await import('@/lib/stores/grinderStore');
    useGrinderStore.setState({
      grinders: await repositories.grinderRepository.list(),
      initialized: true,
    });
    emit('grinderDataChanged', { source: 'local' });
  }
  if (entities.has('settings')) {
    const [{ useSettingsStore }, { callStoreActionInMutation }] =
      await Promise.all([
        import('@/lib/stores/settingsStore'),
        import('@/lib/data/storeMutationBoundary'),
      ]);
    await callStoreActionInMutation(useSettingsStore.getState().loadSettings);
    if (useSettingsStore.getState().error)
      throw new Error('Unable to reload settings after commit.');
    emit('settingsChanged', {
      source: 'local',
      settings: useSettingsStore.getState().settings,
    });
  }
  if (entities.has('bean') || entities.has('brew_note')) {
    const integrity = await import('@/lib/app/dataIntegrity');
    await integrity.clearExpectedCoreDataDeletion();
    await integrity.markExpectedCoreDataDeletionIfEmpty();
  }
}
