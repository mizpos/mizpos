/**
 * Stripe Terminal Provider
 *
 * Stripe Terminal SDKの初期化とコンテキスト提供
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  StripeTerminalProvider as RNStripeTerminalProvider,
  useStripeTerminal,
  Reader,
  PaymentIntent,
} from '@stripe/stripe-terminal-react-native';
import { getConnectionToken } from '@/services/api';

// ==========================================
// Bluetooth権限リクエスト（Android 12+）
// ==========================================

const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    const allGranted = Object.values(granted).every(
      (status) => status === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      console.warn('Bluetooth permissions not granted:', granted);
    }

    return allGranted;
  } catch (err) {
    console.error('Error requesting Bluetooth permissions:', err);
    return false;
  }
};

// ==========================================
// 型定義
// ==========================================

interface CollectPaymentResult {
  paymentIntent?: PaymentIntent.Type;
  error?: { code: string; message: string };
}

interface CreatePaymentResult {
  paymentIntent?: PaymentIntent.Type;
  error?: { code: string; message: string };
}

interface TerminalContextValue {
  // 接続状態
  isInitialized: boolean;
  connectedReader: Reader.Type | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Reader管理
  discoveredReaders: Reader.Type[];
  discoverReaders: () => Promise<void>;
  connectReader: (reader: Reader.Type) => Promise<void>;
  disconnectReader: () => Promise<void>;

  // 決済
  isProcessing: boolean;
  createPaymentIntent: (amount: number, currency?: string) => Promise<CreatePaymentResult>;
  collectPaymentMethod: (paymentIntent: PaymentIntent.Type) => Promise<CollectPaymentResult>;
  processPayment: (paymentIntent: PaymentIntent.Type) => Promise<CollectPaymentResult>;
  cancelCollectPaymentMethod: () => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

// ==========================================
// Token Provider（バックエンドからトークンを取得）
// ==========================================

const fetchConnectionToken = async (): Promise<string> => {
  try {
    return await getConnectionToken();
  } catch (error) {
    console.error('Error fetching connection token:', error);
    throw error;
  }
};

// ==========================================
// Inner Provider（SDK hooks を使用）
// ==========================================

function TerminalProviderInner({ children }: { children: ReactNode }) {
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader.Type[]>([]);

  const {
    initialize,
    discoverReaders: sdkDiscoverReaders,
    connectReader: sdkConnectReader,
    disconnectReader: sdkDisconnectReader,
    createPaymentIntent: sdkCreatePaymentIntent,
    collectPaymentMethod: sdkCollectPaymentMethod,
    confirmPaymentIntent,
    cancelCollectPaymentMethod: sdkCancelCollect,
    connectedReader: sdkConnectedReader,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers) => {
      setDiscoveredReaders(readers);
    },
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // connectedReaderをnull/Reader.Typeに正規化
  const connectedReader = sdkConnectedReader ?? null;

  // SDK初期化
  const initializeTerminal = useCallback(async () => {
    try {
      const result = await initialize();
      if (result.error) {
        console.error('Failed to initialize terminal:', result.error);
        setConnectionError(result.error.message);
        return;
      }
      setIsInitialized(true);
      setConnectionError(null);
    } catch (err) {
      console.error('Error initializing terminal:', err);
      setConnectionError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [initialize]);

  // 初回レンダリング時に初期化
  React.useEffect(() => {
    if (!isInitialized) {
      initializeTerminal();
    }
  }, [isInitialized, initializeTerminal]);

  // Readerを検出
  const discoverReaders = useCallback(async () => {
    if (!isInitialized) {
      setConnectionError('Terminal not initialized');
      return;
    }

    try {
      setDiscoveredReaders([]);
      setConnectionError(null);

      // Android: Bluetooth権限をリクエスト
      const hasPermissions = await requestBluetoothPermissions();
      if (!hasPermissions) {
        setConnectionError('Bluetooth権限が必要です');
        return;
      }

      const { error } = await sdkDiscoverReaders({
        discoveryMethod: 'bluetoothScan',
        simulated: false, // 実機のリーダーに接続
      });

      if (error) {
        console.error('Error discovering readers:', error);
        setConnectionError(error.message);
      }
    } catch (err) {
      console.error('Error discovering readers:', err);
      setConnectionError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [isInitialized, sdkDiscoverReaders]);

  // Readerに接続
  const connectReader = useCallback(
    async (reader: Reader.Type) => {
      if (!isInitialized) {
        setConnectionError('Terminal not initialized');
        return;
      }

      try {
        setIsConnecting(true);
        setConnectionError(null);

        const { error } = await sdkConnectReader(
          {
            reader,
            locationId: reader.location?.id,
          },
          'bluetoothScan'
        );

        if (error) {
          console.error('Error connecting to reader:', error);
          setConnectionError(error.message);
          return;
        }

        console.log('Connected to reader:', reader.serialNumber);
      } catch (err) {
        console.error('Error connecting to reader:', err);
        setConnectionError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsConnecting(false);
      }
    },
    [isInitialized, sdkConnectReader]
  );

  // Readerから切断
  const disconnectReader = useCallback(async () => {
    try {
      await sdkDisconnectReader();
      setConnectionError(null);
    } catch (err) {
      console.error('Error disconnecting reader:', err);
      setConnectionError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [sdkDisconnectReader]);

  // PaymentIntentを作成（SDKで直接作成）
  const createPaymentIntent = useCallback(
    async (amount: number, currency: string = 'jpy'): Promise<CreatePaymentResult> => {
      if (!connectedReader) {
        return { error: { code: 'no_reader', message: 'No reader connected' } };
      }

      try {
        setIsProcessing(true);
        setConnectionError(null);

        const result = await sdkCreatePaymentIntent({
          amount,
          currency,
          captureMethod: 'automatic',
        });

        if (result.error) {
          console.error('Error creating payment intent:', result.error);
          setConnectionError(result.error.message);
          return { error: { code: String(result.error.code || 'error'), message: result.error.message } };
        }

        console.log('PaymentIntent created:', result.paymentIntent?.id);
        return { paymentIntent: result.paymentIntent };
      } catch (err) {
        console.error('Error creating payment intent:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setConnectionError(message);
        return { error: { code: 'exception', message } };
      } finally {
        setIsProcessing(false);
      }
    },
    [connectedReader, sdkCreatePaymentIntent]
  );

  // カード情報を収集
  const collectPaymentMethod = useCallback(
    async (paymentIntent: PaymentIntent.Type): Promise<CollectPaymentResult> => {
      if (!connectedReader) {
        setConnectionError('No reader connected');
        return { error: { code: 'no_reader', message: 'No reader connected' } };
      }

      try {
        setIsProcessing(true);
        setConnectionError(null);

        const result = await sdkCollectPaymentMethod({
          paymentIntent,
        });

        if (result.error) {
          console.error('Error collecting payment method:', result.error);
          setConnectionError(result.error.message);
          return { error: { code: String(result.error.code || 'error'), message: result.error.message } };
        }

        console.log('Payment method collected');
        return { paymentIntent: result.paymentIntent };
      } catch (err) {
        console.error('Error collecting payment method:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setConnectionError(message);
        return { error: { code: 'exception', message } };
      } finally {
        setIsProcessing(false);
      }
    },
    [connectedReader, sdkCollectPaymentMethod]
  );

  // 決済を確定
  const processPayment = useCallback(
    async (paymentIntent: PaymentIntent.Type): Promise<CollectPaymentResult> => {
      try {
        setIsProcessing(true);
        setConnectionError(null);

        const result = await confirmPaymentIntent({
          paymentIntent,
        });

        if (result.error) {
          console.error('Error confirming payment:', result.error);
          setConnectionError(result.error.message);
          return { error: { code: String(result.error.code || 'error'), message: result.error.message } };
        }

        console.log('Payment confirmed');
        return { paymentIntent: result.paymentIntent };
      } catch (err) {
        console.error('Error confirming payment:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setConnectionError(message);
        return { error: { code: 'exception', message } };
      } finally {
        setIsProcessing(false);
      }
    },
    [confirmPaymentIntent]
  );

  // カード収集をキャンセル
  const cancelCollectPaymentMethod = useCallback(async () => {
    try {
      await sdkCancelCollect();
      setIsProcessing(false);
      setConnectionError(null);
    } catch (err) {
      console.error('Error canceling collection:', err);
    }
  }, [sdkCancelCollect]);

  const contextValue: TerminalContextValue = {
    isInitialized,
    connectedReader,
    isConnecting,
    connectionError,
    discoveredReaders,
    discoverReaders,
    connectReader,
    disconnectReader,
    isProcessing,
    createPaymentIntent,
    collectPaymentMethod,
    processPayment,
    cancelCollectPaymentMethod,
  };

  return (
    <TerminalContext.Provider value={contextValue}>
      {children}
    </TerminalContext.Provider>
  );
}

// ==========================================
// Main Provider（SDK Provider をラップ）
// ==========================================

interface StripeTerminalProviderProps {
  children: ReactNode;
}

export function TerminalProvider({ children }: StripeTerminalProviderProps) {
  return (
    <RNStripeTerminalProvider
      tokenProvider={fetchConnectionToken}
      logLevel="verbose"
    >
      <TerminalProviderInner>{children}</TerminalProviderInner>
    </RNStripeTerminalProvider>
  );
}

// ==========================================
// Hook
// ==========================================

export function useTerminal(): TerminalContextValue {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
