import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { FriendWatchStatusItem } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface FriendsWatchedContextType {
  friendsWatchedMap: Record<number, FriendWatchStatusItem[]>;
  isLoading: boolean;
  refreshFriendsWatched: () => Promise<void>;
  getFriendsForTitle: (titleId: number) => FriendWatchStatusItem[];
}

const FriendsWatchedContext = createContext<FriendsWatchedContextType | undefined>(undefined);

export const FriendsWatchedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [friendsWatchedMap, setFriendsWatchedMap] = useState<Record<number, FriendWatchStatusItem[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshFriendsWatched = useCallback(async (isSilent = false) => {
    if (!user) {
      setFriendsWatchedMap({});
      return;
    }
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const summary = await api.getFriendsWatchedSummary();
      if (summary) {
        setFriendsWatchedMap(summary);
      }
    } catch (err) {
      console.error('Failed to load friends watched summary', err);
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    refreshFriendsWatched();
  }, [refreshFriendsWatched]);

  // Periodic background sync and on-window-focus sync
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshFriendsWatched(true);
      }
    }, 20000);

    const handleFocus = () => {
      refreshFriendsWatched(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshFriendsWatched]);

  const getFriendsForTitle = useCallback(
    (titleId: number): FriendWatchStatusItem[] => {
      return friendsWatchedMap[titleId] || [];
    },
    [friendsWatchedMap]
  );

  return (
    <FriendsWatchedContext.Provider
      value={{
        friendsWatchedMap,
        isLoading,
        refreshFriendsWatched,
        getFriendsForTitle,
      }}
    >
      {children}
    </FriendsWatchedContext.Provider>
  );
};

export const useFriendsWatched = (): FriendsWatchedContextType => {
  const context = useContext(FriendsWatchedContext);
  if (!context) {
    throw new Error('useFriendsWatched must be used within a FriendsWatchedProvider');
  }
  return context;
};
