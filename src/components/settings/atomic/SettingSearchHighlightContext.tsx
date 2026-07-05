import React from 'react';

interface SettingSearchHighlightContextValue {
  highlightedSettingId: string | null;
}

const SettingSearchHighlightContext =
  React.createContext<SettingSearchHighlightContextValue>({
    highlightedSettingId: null,
  });

interface SettingSearchHighlightProviderProps {
  highlightedSettingId?: string | null;
  children: React.ReactNode;
}

export const SettingSearchHighlightProvider: React.FC<
  SettingSearchHighlightProviderProps
> = ({ highlightedSettingId = null, children }) => {
  const value = React.useMemo(
    () => ({ highlightedSettingId }),
    [highlightedSettingId]
  );

  return (
    <SettingSearchHighlightContext.Provider value={value}>
      {children}
    </SettingSearchHighlightContext.Provider>
  );
};

export const useSettingSearchHighlight = () =>
  React.useContext(SettingSearchHighlightContext);

export const useScrollToHighlightedSetting = (watchKey?: unknown) => {
  const { highlightedSettingId } = useSettingSearchHighlight();

  React.useEffect(() => {
    if (!highlightedSettingId) return;
    if (typeof document === 'undefined') return;

    window.setTimeout(() => {
      const escapedId =
        typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(highlightedSettingId)
          : highlightedSettingId.replace(/"/g, '\\"');
      document
        .querySelector(`[data-settings-search-id="${escapedId}"]`)
        ?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
    }, 120);
  }, [highlightedSettingId, watchKey]);

  return highlightedSettingId;
};
