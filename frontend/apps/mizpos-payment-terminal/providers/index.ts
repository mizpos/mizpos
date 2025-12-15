/**
 * Providers エクスポート
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

// Expo Goで実行中かどうかを判定
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// 環境に応じてTerminalProviderを切り替え
// Expo GoではネイティブモジュールがないためMockを使用
export const { TerminalProvider, useTerminal } = isExpoGo
  ? require('./StripeTerminalProvider.mock')
  : require('./StripeTerminalProvider');

export { PairingProvider, usePairing } from './PairingProvider';
export type { PairingInfo, PaymentRequest, PaymentResult } from './PairingProvider';
