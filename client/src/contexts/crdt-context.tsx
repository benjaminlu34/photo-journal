'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { useBoardStore } from '@/lib/board-store';
import { getBoardSdk } from '@/lib/board-sdk';
import type { NoteData } from '@/types/notes';
import type { User } from '@shared/schema/schema';

interface CRDTContextValue {
  isConnected: boolean;
  spaceId: string | undefined;
}

const CRDTContext = createContext<CRDTContextValue | null>(null);

export const useCRDT = (): CRDTContextValue => {
  const context = useContext(CRDTContext);
  if (!context) {
    throw new Error('useCRDT must be used within a CRDTProvider');
  }
  return context;
};

interface CRDTProviderProps {
  children: React.ReactNode;
  spaceId?: string;
}

export const CRDTProvider: React.FC<CRDTProviderProps> = ({ 
  children, 
  spaceId 
}) => {
  const { data: user } = useUser();
  const { init } = useBoardStore((s) => s.actions);
  
  // Initialize board store with the SDK only when we have a valid spaceId
  React.useEffect(() => {
    if (!spaceId) {
      return; // Don't initialize until we have a valid spaceId
    }
    
    // Initialize CRDT with spaceId
    init(spaceId, user?.id || 'anonymous', user?.firstName || 'Anonymous', user?.username);
  }, [spaceId, init, user]);

  // Get connection status from the SDK
  const [isConnected, setIsConnected] = React.useState(false);
  React.useEffect(() => {
    if (!spaceId) {
      setIsConnected(false);
      return; // Don't initialize until we have a valid spaceId
    }
    
    const sdk = getBoardSdk(spaceId, user?.id || 'anonymous', user?.firstName || 'Anonymous', user?.username);
    const awareness = sdk.presence;
    
    const handleConnectivityChange = () => {
      setIsConnected(awareness.getStates().size > 0);
    };
    
    awareness.on('change', handleConnectivityChange);
    handleConnectivityChange(); // Initial check
    
    return () => {
      awareness.off('change', handleConnectivityChange);
    };
  }, [spaceId, user]);

  const value = React.useMemo<CRDTContextValue>(() => ({
    isConnected,
    spaceId,
  }), [isConnected, spaceId]);

  return (
    <CRDTContext.Provider value={value}>
      {children}
    </CRDTContext.Provider>
  );
}; 