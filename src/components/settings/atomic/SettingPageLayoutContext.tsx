import React from 'react';

export type SettingPageLayoutMode = 'overlay' | 'embedded';

const SettingPageLayoutContext =
  React.createContext<SettingPageLayoutMode>('overlay');

interface SettingPageLayoutProviderProps {
  mode: SettingPageLayoutMode;
  children: React.ReactNode;
}

export const SettingPageLayoutProvider: React.FC<
  SettingPageLayoutProviderProps
> = ({ mode, children }) => {
  return (
    <SettingPageLayoutContext.Provider value={mode}>
      {children}
    </SettingPageLayoutContext.Provider>
  );
};

export const useSettingPageLayoutMode = (): SettingPageLayoutMode =>
  React.useContext(SettingPageLayoutContext);
