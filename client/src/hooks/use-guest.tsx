import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface GuestContextType {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const GuestContext = createContext<GuestContextType>({
  isGuest: false,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
});

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(() => {
    return sessionStorage.getItem("vibra-guest-mode") === "1";
  });

  const enterGuestMode = useCallback(() => {
    sessionStorage.setItem("vibra-guest-mode", "1");
    setIsGuest(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    sessionStorage.removeItem("vibra-guest-mode");
    setIsGuest(false);
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  return useContext(GuestContext);
}
