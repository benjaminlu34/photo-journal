'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useUser } from '../hooks/useUser';
import { useBoardStore } from '../lib/board-store';
import { getBoardSdk } from '../lib/board-sdk';
import type { NoteData } from '../types/notes';
import type { User } from '@shared/schema';

interface CRDTContextValue {
  isConnected: boolean;
  spaceId: string;
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
  spaceId = 'default-board' 
}) => {
  const { data: user } = useUser();
  const { init } = useBoardStore((s) => s.actions);
  
  // Initialize board store with the SDK
  React.useEffect(() => {
    init(spaceId, user?.id || 'anonymous', user?.firstName || 'Anonymous');
  }, [spaceId, init, user]);

  // Get connection status from the SDK
  const [isConnected, setIsConnected] = React.useState(false);
  React.useEffect(() => {
    const sdk = getBoardSdk(spaceId, user?.id || 'anonymous', user?.firstName || 'Anonymous');
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