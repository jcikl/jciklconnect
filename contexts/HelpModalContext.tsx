// HelpModalContext – allows child components to open the App Help modal
import React, { createContext, useContext } from 'react';

interface HelpModalContextValue {
  openHelp: () => void;
}

const HelpModalContext = createContext<HelpModalContextValue | null>(null);

export const HelpModalProvider: React.FC<{
  onOpenHelp: () => void;
  children: React.ReactNode;
}> = ({ onOpenHelp, children }) => {
  const value: HelpModalContextValue = React.useMemo(
    () => ({ openHelp: onOpenHelp }),
    [onOpenHelp]
  );
  return (
    <HelpModalContext.Provider value={value}>
      {children}
    </HelpModalContext.Provider>
  );
};

export function useHelpModal(): HelpModalContextValue | null {
  return useContext(HelpModalContext);
}
