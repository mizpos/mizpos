/**
 * Location Provider
 *
 * Stripe Terminalの店舗（Location）選択状態を管理
 * 選択した店舗情報はSecureStoreに永続化
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { getLocations, type TerminalLocation } from '@/services/api';

// ==========================================
// 型定義
// ==========================================

interface LocationContextValue {
  // 選択された店舗
  selectedLocation: TerminalLocation | null;
  isLocationSelected: boolean;

  // 店舗一覧
  locations: TerminalLocation[];
  isLoadingLocations: boolean;
  loadLocationsError: string | null;

  // 操作
  loadLocations: () => Promise<void>;
  selectLocation: (location: TerminalLocation) => Promise<void>;
  clearLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

// ==========================================
// 定数
// ==========================================

const STORAGE_KEY = '@mizpos/selected_location';

// ==========================================
// Provider
// ==========================================

interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const [selectedLocation, setSelectedLocation] = useState<TerminalLocation | null>(null);
  const [locations, setLocations] = useState<TerminalLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [loadLocationsError, setLoadLocationsError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * SecureStoreから保存された店舗情報を読み込み
   */
  const loadSavedLocation = useCallback(async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORAGE_KEY);
      if (saved) {
        const location = JSON.parse(saved) as TerminalLocation;
        setSelectedLocation(location);
        console.log('[Location] Loaded saved location:', location.display_name);
      }
    } catch (err) {
      console.error('[Location] Failed to load saved location:', err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  /**
   * 初回読み込み
   */
  useEffect(() => {
    loadSavedLocation();
  }, [loadSavedLocation]);

  /**
   * 店舗一覧を取得
   */
  const loadLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLoadLocationsError(null);

    try {
      const result = await getLocations();
      setLocations(result);
      console.log('[Location] Loaded locations:', result.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : '店舗一覧の取得に失敗しました';
      setLoadLocationsError(message);
      console.error('[Location] Failed to load locations:', err);
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  /**
   * 店舗を選択して保存
   */
  const selectLocation = useCallback(async (location: TerminalLocation) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(location));
      setSelectedLocation(location);
      console.log('[Location] Selected location:', location.display_name);
    } catch (err) {
      console.error('[Location] Failed to save location:', err);
      throw new Error('店舗情報の保存に失敗しました');
    }
  }, []);

  /**
   * 選択した店舗をクリア
   */
  const clearLocation = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      setSelectedLocation(null);
      console.log('[Location] Cleared selected location');
    } catch (err) {
      console.error('[Location] Failed to clear location:', err);
    }
  }, []);

  const contextValue: LocationContextValue = {
    selectedLocation,
    isLocationSelected: selectedLocation !== null,
    locations,
    isLoadingLocations,
    loadLocationsError,
    loadLocations,
    selectLocation,
    clearLocation,
  };

  // 初期化が完了するまで待機
  if (!isInitialized) {
    return null;
  }

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
}

// ==========================================
// Hook
// ==========================================

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
