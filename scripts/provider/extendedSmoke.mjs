import assert from 'node:assert/strict';

/** Real bundled-engine calls for additional business families; no direct row edits. */
export function exerciseExtendedFamilies(call, { bean, equipment, png }) {
  let sequence = 0;
  const mutate = (name, args) =>
    call(name, { requestId: `extended-${++sequence}`, ...args });
  const remove = (previewName, deleteName, args) => {
    const preview = call(previewName, args);
    return mutate(deleteName, {
      ...args,
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    });
  };
  const preferences = call('get_preferences');
  mutate('update_preferences', {
    expectedVersion: preferences.version,
    patch: { showFlowRate: true },
  });
  assert.equal(call('get_preferences').preferences.showFlowRate, true);

  let groups = mutate('create_bean_group', {
    expectedVersion: call('list_bean_groups').version,
    name: 'Provider group',
    beanIds: [bean.id, bean.id],
  });
  const group = groups.items[0];
  assert.deepEqual(group.beanIds, [bean.id]);
  groups = mutate('update_bean_group', {
    expectedVersion: groups.version,
    id: group.id,
    name: 'Renamed group',
  });
  mutate('reorder_bean_groups', {
    expectedVersion: groups.version,
    ids: [group.id],
  });
  const groupPreview = call('preview_delete_preferences_item', {
    kind: 'group',
    id: group.id,
  });
  mutate('delete_bean_group', {
    id: group.id,
    expectedVersion: groupPreview.version,
    confirmationToken: groupPreview.confirmationToken,
  });
  assert.equal(call('list_bean_groups').items.length, 0);

  const dimensions = call('get_flavor_dimensions');
  const changed = mutate('upsert_flavor_dimension', {
    expectedVersion: dimensions.version,
    id: 'acidity',
    label: 'Bright',
  });
  assert(JSON.stringify(changed).includes('Bright'));
  const dimensionPreview = call('preview_delete_preferences_item', {
    kind: 'flavor_dimension',
    id: 'acidity',
  });
  mutate('delete_flavor_dimension', {
    id: 'acidity',
    expectedVersion: dimensionPreview.version,
    confirmationToken: dimensionPreview.confirmationToken,
  });

  const flavorPeriod = {
    light: { startDay: 1, endDay: 10 },
    medium: { startDay: 2, endDay: 8 },
    dark: { startDay: 0, endDay: 5 },
  };
  mutate('upsert_roaster_config', {
    expectedVersion: call('list_roaster_configs').version,
    roasterName: 'Provider roaster',
    flavorPeriod,
  });
  const logo = call('get_roaster_logo', { roasterName: 'Provider roaster' });
  mutate('set_roaster_logo', {
    roasterName: 'Provider roaster',
    expectedVersion: logo.version,
    image: png,
  });
  assert.equal(
    call('get_roaster_logo', { roasterName: 'Provider roaster' }).hasLogo,
    true
  );
  remove('preview_delete_roaster_logo', 'delete_roaster_logo', {
    roasterName: 'Provider roaster',
  });
  assert.equal(
    call('get_roaster_logo', { roasterName: 'Provider roaster' }).hasLogo,
    false
  );
  assert(JSON.stringify(call('list_roaster_configs')).includes('startDay'));

  const report = mutate('upsert_historical_report', {
    expectedVersion: call('list_historical_reports').version,
    year: 2025,
    username: 'Provider',
    content: 'Local report',
    extraJson: '{"format":"markdown"}',
  });
  assert.equal(
    call('get_historical_report', { id: report.item.id }).item.format,
    'markdown'
  );
  remove('preview_delete_historical_report', 'delete_historical_report', {
    id: report.item.id,
  });
  assert.equal(call('list_historical_reports').total, 0);

  const source = call('list_method', { equipmentId: 'V60' }).items[0];
  const before = call('get_method', {
    equipmentId: 'V60',
    id: source.id,
  }).method;
  mutate('set_method_override', {
    equipmentId: 'V60',
    id: source.id,
    expectedVersion: before.version,
    expectedOverrideVersion: before.overrideVersion,
    params: { coffee: '17g' },
  });
  assert.equal(
    call('get_method', { equipmentId: 'V60', id: source.id }).method
      .effectiveParams.coffee,
    '17g'
  );
  const copied = mutate('copy_method', {
    equipmentId: 'V60',
    id: source.id,
    expectedVersion: before.version,
    targetEquipmentId: equipment.id,
  }).method;
  assert.equal(copied.readOnly, false);
  const catalog = call('get_catalog_preferences');
  mutate('update_catalog_preferences', {
    expectedVersion: catalog.version,
    equipmentId: equipment.id,
    hidden: true,
  });
  assert(
    JSON.stringify(call('get_catalog_preferences')).includes(equipment.id)
  );
  remove('preview_delete_method', 'delete_method', {
    equipmentId: equipment.id,
    id: copied.id,
  });

  const green = mutate('create_bean', {
    bean: {
      name: 'Green provider',
      beanState: 'green',
      capacityGrams: 500,
      remainingGrams: 500,
    },
  }).bean;
  const roast = mutate('create_roasting_record', {
    greenBeanId: green.id,
    greenExpectedVersion: green.version,
    roastedAmountGrams: 100,
    roastedBean: { capacityGrams: 80 },
  });
  assert.equal(call('get_bean', { id: green.id }).bean.remainingGrams, 400);
  assert.equal(
    call('get_bean', { id: roast.roastedBean.id }).bean.remainingGrams,
    80
  );
  call('list_roasting_records');
  call('get_roasting_record', { id: roast.note.id });
  mutate('update_roasting_record', {
    id: roast.note.id,
    expectedVersion: roast.note.version,
    greenExpectedVersion: call('get_bean', { id: green.id }).bean.version,
    roastedAmountGrams: 110,
  });
  assert.equal(call('get_bean', { id: green.id }).bean.remainingGrams, 390);
  remove('preview_delete_roasting_record', 'delete_roasting_record', {
    id: roast.note.id,
  });
  assert.equal(call('get_bean', { id: green.id }).bean.remainingGrams, 500);

  const convertible = mutate('create_bean', {
    bean: { name: 'Legacy roasted', capacityGrams: 100, remainingGrams: 80 },
  }).bean;
  const conversion = call('preview_convert_roasted_to_green', {
    id: convertible.id,
  });
  const converted = mutate('convert_roasted_to_green', {
    id: convertible.id,
    expectedVersion: conversion.version,
    confirmationToken: conversion.confirmationToken,
    confirmAction: 'convert_roasted_to_green',
  });
  assert.equal(
    call('get_bean', { id: converted.greenBean.id }).bean.beanState,
    'green'
  );
  assert(call('get_statistics').inventory.length > 0);
  assert(call('get_inventory_summary'));
  const renamed = {
    fromName: 'Provider roaster',
    toName: 'Renamed provider roaster',
  };
  const renamePreview = call('preview_roaster_rename', renamed);
  mutate('rename_roaster', {
    ...renamed,
    expectedVersion: renamePreview.version,
    confirmationToken: renamePreview.confirmationToken,
  });
  const roasterPreview = call('preview_delete_preferences_item', {
    kind: 'roaster_config',
    id: renamed.toName,
  });
  mutate('delete_roaster_config', {
    id: renamed.toName,
    expectedVersion: roasterPreview.version,
    confirmationToken: roasterPreview.confirmationToken,
  });
  const reorderedDimensions = call('get_flavor_dimensions');
  mutate('reorder_flavor_dimensions', {
    expectedVersion: reorderedDimensions.version,
    ids: reorderedDimensions.dimensions.map(item => item.id).reverse(),
  });

  assert(call('list_equipment').items.length > 0);
  const currentEquipment = call('get_equipment', {
    id: equipment.id,
  }).equipment;
  mutate('update_equipment', {
    id: equipment.id,
    expectedVersion: currentEquipment.version,
    changes: { note: 'Headless smoke' },
  });
  const recipe = mutate('create_method', {
    equipmentId: equipment.id,
    method: {
      name: 'Headless recipe',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: 'fine',
        temp: '92°C',
        stages: [],
      },
    },
  }).method;
  mutate('update_method', {
    id: recipe.id,
    equipmentId: equipment.id,
    expectedVersion: recipe.version,
    changes: { name: 'Updated recipe' },
  });
  const methods = call('list_method', { equipmentId: equipment.id });
  mutate('reorder_method', {
    equipmentId: equipment.id,
    expectedVersion: methods.collectionVersion,
    ids: methods.items.filter(item => !item.readOnly).map(item => item.id),
  });
  remove('preview_delete_equipment', 'delete_equipment', { id: equipment.id });
  const grinder = call('list_grinder').items[0];
  const currentGrinder = call('get_grinder', { id: grinder.id }).grinder;
  mutate('update_grinder', {
    id: grinder.id,
    expectedVersion: currentGrinder.version,
    changes: { currentGrindSize: '22' },
  });
  remove('preview_delete_grinder', 'delete_grinder', { id: grinder.id });

  const latestBean = call('get_bean', { id: bean.id }).bean;
  mutate('update_bean', {
    id: bean.id,
    expectedVersion: latestBean.version,
    changes: { notes: 'Preserve user prose' },
  });
  const adjustment = mutate('adjust_bean_inventory', {
    id: bean.id,
    expectedVersion: call('get_bean', { id: bean.id }).bean.version,
    deltaGrams: -10,
    recordType: 'capacity-adjustment',
  });
  const adjusted = mutate('update_brew_note_capacity_adjustment', {
    id: adjustment.adjustmentNote.id,
    expectedVersion: adjustment.adjustmentNote.version,
    targetExpectedVersion: call('get_bean', { id: bean.id }).bean.version,
    changeGrams: -12,
  });
  const convertedNote = mutate('convert_capacity_adjustment_to_brew_note', {
    id: adjusted.note.id,
    expectedVersion: adjusted.note.version,
    targetExpectedVersion: call('get_bean', { id: bean.id }).bean.version,
    coffeeGrams: 5,
  }).note;
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 95);
  const convertedDelete = call('preview_delete', {
    entity: 'brew_note',
    id: convertedNote.id,
  });
  mutate('delete_brew_note', {
    id: convertedNote.id,
    expectedVersion: convertedNote.version,
    confirmationToken: convertedDelete.confirmationToken,
  });
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 100);
  const photoNote = mutate('create_brew_note', {
    note: { recordType: 'brew', notes: 'Photo note' },
    images: [png],
  }).note;
  const readNote = call('get_brew_note', { id: photoNote.id }).note;
  const imageId = readNote.images[0].imageId;
  assert(call('get_brew_note_image', { id: photoNote.id, imageId }));
  const photoPreview = call('preview_delete', {
    entity: 'brew_note_image',
    id: photoNote.id,
    imageId,
  });
  mutate('delete_brew_note_image', {
    id: photoNote.id,
    imageId,
    expectedVersion: readNote.version,
    confirmationToken: photoPreview.confirmationToken,
  });
  assert.equal(
    call('get_brew_note', { id: photoNote.id }).note.images.length,
    0
  );
  const beanPreview = call('preview_delete', { entity: 'bean', id: bean.id });
  mutate('delete_bean', {
    id: bean.id,
    expectedVersion: call('get_bean', { id: bean.id }).bean.version,
    confirmationToken: beanPreview.confirmationToken,
  });
}
