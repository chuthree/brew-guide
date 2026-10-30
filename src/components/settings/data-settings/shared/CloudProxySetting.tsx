import { detectAppRuntime } from '@/lib/app/runtime';
import SettingRow from '../../atomic/SettingRow';
import SettingInput from '../../atomic/SettingInput';

export function CloudProxySetting({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  if (detectAppRuntime().runtime !== 'web') {
    return null;
  }

  return (
    <SettingRow
      label="自定义代理"
      isSubSetting
      expandControl
      isLast={false}
    >
      <SettingInput
        aria-label="自定义代理"
        required
        type="url"
        autoCapitalize="none"
        spellCheck={false}
        value={value || ''}
        placeholder="代理地址"
        onChange={event => onChange(event.target.value)}
      />
    </SettingRow>
  );
}
