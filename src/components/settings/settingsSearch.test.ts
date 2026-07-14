import { describe, expect, it } from 'vitest';
import {
  getBeanSettingsSearchRevealState,
  makeSettingRowSearchId,
  shouldRevealGreenBeanSearchSettings,
} from './settingsSearch';

describe('settings search reveal state', () => {
  it('reveals conditional bean settings for the selected result', () => {
    expect(
      getBeanSettingsSearchRevealState(makeSettingRowSearchId('总价'))
    ).toMatchObject({ priceDetails: true, beanFields: false });
    expect(
      getBeanSettingsSearchRevealState(makeSettingRowSearchId('备注内容'))
    ).toMatchObject({ noteDetails: true });
  });

  it('opens the bean field drawer for nested field results', () => {
    expect(
      getBeanSettingsSearchRevealState(makeSettingRowSearchId('烘焙商'))
    ).toMatchObject({ beanFields: true });
    expect(
      getBeanSettingsSearchRevealState(makeSettingRowSearchId('烘焙商分隔符'))
    ).toMatchObject({ beanFields: true });
    expect(
      getBeanSettingsSearchRevealState(makeSettingRowSearchId('产国'))
    ).toMatchObject({ beanFields: true });
    expect(
      getBeanSettingsSearchRevealState(makeSettingRowSearchId('咖啡豆字段'))
    ).toMatchObject({ beanFields: false });
  });

  it('reveals disabled green-bean sections only for their nested results', () => {
    expect(
      shouldRevealGreenBeanSearchSettings(
        makeSettingRowSearchId('预设快捷烘焙量')
      )
    ).toBe(true);
    expect(
      shouldRevealGreenBeanSearchSettings(makeSettingRowSearchId('启用生豆库'))
    ).toBe(false);
  });
});
