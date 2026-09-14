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

  const refreshFriendsWatched = useCallback(async () => {
    if (!user) {
      setFriendsWatchedMap({});
      return;
    }
    setIsLoading(true);
    try {
      const summary = await api.getFriendsWatchedSummary();
      setFriendsWatchedMap(summary);
    } catch (err) {
      console.error('Failed to load friends watched summary', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshFriendsWatched();
  }, [refreshFriendsWatched]);

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
