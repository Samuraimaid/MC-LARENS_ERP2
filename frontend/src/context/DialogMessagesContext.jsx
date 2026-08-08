import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DIALOG_MESSAGES,
  getDialogMessageSync,
  loadDialogMessages,
  seedDialogMessagesCache,
} from "@/lib/dialogMessages";
import { useAuth } from "@/context/AuthContext";

const DialogMessagesContext = createContext({
  ready: false,
  messagesByKey: DEFAULT_DIALOG_MESSAGES,
  getMessage: (key, vars) => getDialogMessageSync(key, vars),
  refresh: async () => DEFAULT_DIALOG_MESSAGES,
});

export function DialogMessagesProvider({ children }) {
  const { user } = useAuth();
  const [messagesByKey, setMessagesByKey] = useState(DEFAULT_DIALOG_MESSAGES);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (force = true) => {
    const next = await loadDialogMessages({ force });
    setMessagesByKey(next);
    seedDialogMessagesCache(next);
    setReady(true);
    return next;
  }, []);

  useEffect(() => {
    if (!user) {
      setMessagesByKey(DEFAULT_DIALOG_MESSAGES);
      setReady(false);
      return undefined;
    }
    let cancelled = false;
    loadDialogMessages({ force: true }).then((next) => {
      if (cancelled) return;
      setMessagesByKey(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.user_id, user?.role]);

  const getMessage = useCallback(
    (key, vars = {}) => getDialogMessageSync(key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messagesByKey],
  );

  const value = useMemo(
    () => ({ ready, messagesByKey, getMessage, refresh }),
    [ready, messagesByKey, getMessage, refresh],
  );

  return (
    <DialogMessagesContext.Provider value={value}>
      {children}
    </DialogMessagesContext.Provider>
  );
}

export function useDialogMessages() {
  return useContext(DialogMessagesContext);
}

export function useDialogMessage(key, vars = {}) {
  const { getMessage, ready } = useDialogMessages();
  return useMemo(
    () => ({ ...getMessage(key, vars), ready }),
    // stringify vars for stable memo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getMessage, key, ready, JSON.stringify(vars || {})],
  );
}

export default DialogMessagesProvider;
