import { createContext, useContext } from 'react';

const RunUidContext = createContext<string | undefined>(undefined);

export const RunUidProvider = RunUidContext.Provider;

export const useRunUid = (): string | undefined => useContext(RunUidContext);
