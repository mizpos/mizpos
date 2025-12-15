/**
 * Mock Stripe Terminal Provider
 *
 * Expo Go環境用のモックプロバイダー
 * ネイティブモジュールを使用しないため、Expo Goでも動作する
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Mock types
interface MockReader {
  id: string;
  serialNumber: string;
  deviceType: string;
  status: string;
  location?: { id: string };
}

interface MockPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

interface CollectPaymentResult {
  paymentIntent?: MockPaymentIntent;
  error?: { code: string; message: string };
}

interface CreatePaymentResult {
  paymentIntent?: MockPaymentIntent;
  error?: { code: string; message: string };
}

interface TerminalContextValue {
  // 接続状態
  isInitialized: boolean;
  connectedReader: MockReader | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Reader管理
  discoveredReaders: MockReader[];
  discoverReaders: () => Promise<void>;
  connectReader: (reader: MockReader) => Promise<void>;
  disconnectReader: () => Promise<void>;

  // 決済
  isProcessing: boolean;
  createPaymentIntent: (amount: number, currency?: string) => Promise<CreatePaymentResult>;
  collectPaymentMethod: (paymentIntent: MockPaymentIntent) => Promise<CollectPaymentResult>;
  processPayment: (paymentIntent: MockPaymentIntent) => Promise<CollectPaymentResult>;
  cancelCollectPaymentMethod: () => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

// シミュレート用のリーダー
const SIMULATED_READERS: MockReader[] = [
  {
    id: 'simulated_reader_1',
    serialNumber: 'SIMULATED-001',
    deviceType: 'chipper2X',
    status: 'online',
    location: { id: 'loc_simulated' },
  },
  {
    id: 'simulated_reader_2',
    serialNumber: 'SIMULATED-002',
    deviceType: 'stripeM2',
    status: 'online',
    location: { id: 'loc_simulated' },
  },
];

interface StripeTerminalProviderProps {
  children: ReactNode;
}

export function TerminalProvider({ children }: StripeTerminalProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedReader, setConnectedReader] = useState<MockReader | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<MockReader[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 初期化をシミュレート
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
      console.log('[Mock] Terminal SDK initialized');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // リーダー検出をシミュレート
  const discoverReaders = useCallback(async () => {
    if (!isInitialized) {
      setConnectionError('Terminal not initialized');
      return;
    }

    setDiscoveredReaders([]);
    setConnectionError(null);
    console.log('[Mock] Discovering readers...');

    // 検出をシミュレート
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setDiscoveredReaders(SIMULATED_READERS);
    console.log('[Mock] Found', SIMULATED_READERS.length, 'readers');
  }, [isInitialized]);

  // リーダー接続をシミュレート
  const connectReader = useCallback(async (reader: MockReader) => {
    if (!isInitialized) {
      setConnectionError('Terminal not initialized');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    console.log('[Mock] Connecting to reader:', reader.serialNumber);

    // 接続をシミュレート
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setConnectedReader(reader);
    setIsConnecting(false);
    console.log('[Mock] Connected to reader:', reader.serialNumber);
  }, [isInitialized]);

  // リーダー切断をシミュレート
  const disconnectReader = useCallback(async () => {
    console.log('[Mock] Disconnecting reader');
    await new Promise((resolve) => setTimeout(resolve, 500));
    setConnectedReader(null);
    setConnectionError(null);
    console.log('[Mock] Reader disconnected');
  }, []);

  // PaymentIntent作成をシミュレート
  const createPaymentIntent = useCallback(
    async (amount: number, currency: string = 'jpy'): Promise<CreatePaymentResult> => {
      if (!connectedReader) {
        return { error: { code: 'no_reader', message: 'No reader connected' } };
      }

      setIsProcessing(true);
      setConnectionError(null);
      console.log('[Mock] Creating PaymentIntent:', { amount, currency });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const paymentIntent: MockPaymentIntent = {
        id: `pi_mock_${Date.now()}`,
        amount,
        currency,
        status: 'requires_payment_method',
      };

      setIsProcessing(false);
      console.log('[Mock] PaymentIntent created:', paymentIntent.id);
      return { paymentIntent };
    },
    [connectedReader]
  );

  // カード情報収集をシミュレート
  const collectPaymentMethod = useCallback(
    async (paymentIntent: MockPaymentIntent): Promise<CollectPaymentResult> => {
      if (!connectedReader) {
        return { error: { code: 'no_reader', message: 'No reader connected' } };
      }

      setIsProcessing(true);
      setConnectionError(null);
      console.log('[Mock] Collecting payment method for:', paymentIntent.id);

      // カード読み取りをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const updatedIntent: MockPaymentIntent = {
        ...paymentIntent,
        status: 'requires_confirmation',
      };

      setIsProcessing(false);
      console.log('[Mock] Payment method collected');
      return { paymentIntent: updatedIntent };
    },
    [connectedReader]
  );

  // 決済処理をシミュレート
  const processPayment = useCallback(
    async (paymentIntent: MockPaymentIntent): Promise<CollectPaymentResult> => {
      setIsProcessing(true);
      setConnectionError(null);
      console.log('[Mock] Processing payment:', paymentIntent.id);

      // 決済処理をシミュレート
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const updatedIntent: MockPaymentIntent = {
        ...paymentIntent,
        status: 'succeeded',
      };

      setIsProcessing(false);
      console.log('[Mock] Payment succeeded');
      return { paymentIntent: updatedIntent };
    },
    []
  );

  // キャンセルをシミュレート
  const cancelCollectPaymentMethod = useCallback(async () => {
    console.log('[Mock] Canceling payment collection');
    setIsProcessing(false);
    setConnectionError(null);
  }, []);

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

export function useTerminal(): TerminalContextValue {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
