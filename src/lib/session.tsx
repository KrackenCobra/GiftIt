import { createContext, useContext } from 'react';

/** Lets screens deep in the navigator tell the app root that this phone signed out. */
export const SessionContext = createContext<{ onSignedOut: () => void }>({ onSignedOut: () => undefined });
export const useSession = () => useContext(SessionContext);
