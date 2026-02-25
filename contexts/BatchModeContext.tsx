import React, { createContext, useContext, useState } from 'react';

interface BatchModeContextType {
    isBatchMode: boolean;
    setIsBatchMode: (active: boolean) => void;
}

export const BatchModeContext = createContext<BatchModeContextType>({
    isBatchMode: false,
    setIsBatchMode: () => { },
});

export const useBatchMode = () => useContext(BatchModeContext);

export const BatchModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isBatchMode, setIsBatchMode] = useState(false);

    return (
        <BatchModeContext.Provider value={{ isBatchMode, setIsBatchMode }}>
            {children}
        </BatchModeContext.Provider>
    );
};
