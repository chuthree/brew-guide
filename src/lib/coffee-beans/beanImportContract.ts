import {
  BEAN_FIELD_DEFINITIONS,
  getEnabledBeanFieldIds,
  resolveBeanFieldConfig,
} from './beanFields';
import {
  BEAN_IMPORT_RULES,
  buildBeanImportFieldRules,
} from '@/lib/constants/beanImportRules';
import type { AppSettings } from '@/lib/data/models';

/** Loaded on demand by bean tools, never appended to the default chat prompt. */
export function getBeanImportContract(
  settings?: Pick<AppSettings, 'beanFieldConfig' | 'showEstateField'> | null
) {
  const fieldConfig = resolveBeanFieldConfig(settings);
  return {
    fieldConfig,
    fields: BEAN_FIELD_DEFINITIONS,
    importRules: `${BEAN_IMPORT_RULES}\n\n${buildBeanImportFieldRules(
      BEAN_FIELD_DEFINITIONS,
      getEnabledBeanFieldIds(fieldConfig)
    )}`,
  };
}
