/**
 * 決済処理モーダル
 *
 * カード決済の実行とステータス表示
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { PaymentIntent } from '@stripe/stripe-terminal-react-native';
import type { CardDetails } from '@/services/api';

/**
 * 安全にナビゲーションで戻る
 * 戻れる画面がない場合はホーム画面に遷移
 */
const safeGoBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
};

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTerminal, usePairing } from '@/providers';

type PaymentStep = 'ready' | 'creating' | 'collecting' | 'processing' | 'complete' | 'cancelled' | 'error';

/**
 * PaymentIntentからカード詳細を抽出
 *
 * 取得順序:
 * 1. paymentMethod.cardPresentDetails から取得（推奨）
 * 2. charges[0].paymentMethodDetails.cardPresent から取得（フォールバック）
 */
function extractCardDetails(
  paymentIntent: PaymentIntent.Type | null | undefined,
  terminalSerialNumber?: string
): CardDetails | undefined {
  if (!paymentIntent) return undefined;

  // 方法1: paymentMethod.cardPresentDetails から取得（推奨）
  const cardPresentDetails = paymentIntent.paymentMethod?.cardPresentDetails;
  if (cardPresentDetails) {
    console.log('[Payment] Card details from paymentMethod.cardPresentDetails:', cardPresentDetails);
    return {
      brand: cardPresentDetails.brand || undefined,
      last4: cardPresentDetails.last4 || undefined,
      exp_month: cardPresentDetails.expMonth ? Number(cardPresentDetails.expMonth) : undefined,
      exp_year: cardPresentDetails.expYear ? Number(cardPresentDetails.expYear) : undefined,
      cardholder_name: cardPresentDetails.cardholderName || undefined,
      funding: cardPresentDetails.funding || undefined,
      terminal_serial_number: terminalSerialNumber,
      transaction_type: 'sale',
      payment_type: '一括',
      transaction_at: new Date().toISOString(),
    };
  }

  // 方法2: chargesからカード情報を取得（フォールバック）
  const charges = paymentIntent.charges;
  if (charges && charges.length > 0) {
    const charge = charges[0];
    const cardPresent = charge?.paymentMethodDetails?.cardPresent;

    if (cardPresent) {
      console.log('[Payment] Card details from charges[0].paymentMethodDetails.cardPresent:', cardPresent);
      return {
        brand: cardPresent.brand || undefined,
        last4: cardPresent.last4 || undefined,
        exp_month: cardPresent.expMonth || undefined,
        exp_year: cardPresent.expYear || undefined,
        cardholder_name: cardPresent.cardholderName || undefined,
        funding: cardPresent.funding || undefined,
        terminal_serial_number: terminalSerialNumber,
        transaction_type: 'sale',
        payment_type: '一括',
        transaction_at: new Date().toISOString(),
      };
    }
  }

  console.warn('[Payment] No card details found in paymentIntent:', {
    hasPaymentMethod: !!paymentIntent.paymentMethod,
    hasCardPresentDetails: !!paymentIntent.paymentMethod?.cardPresentDetails,
    chargesLength: paymentIntent.charges?.length || 0,
  });

  return undefined;
}

export default function PaymentScreen() {
  const {
    connectedReader,
    createPaymentIntent,
    collectPaymentMethod,
    processPayment,
    cancelCollectPaymentMethod,
  } = useTerminal();

  const { currentPaymentRequest, completePayment, cancelPayment } = usePairing();

  const [step, setStep] = useState<PaymentStep>('ready');
  const [error, setError] = useState<string | null>(null);
  const [currentPaymentIntent, setCurrentPaymentIntent] = useState<PaymentIntent.Type | null>(null);

  // 自動開始用のref（二重実行防止）
  const hasStartedRef = useRef(false);

  // 決済を開始
  const handleStartPayment = useCallback(async () => {
    if (!currentPaymentRequest) return;

    try {
      setStep('creating');
      setError(null);

      console.log('[Payment] Starting payment for amount:', currentPaymentRequest.amount);

      // PaymentIntentをSDKで作成
      const createResult = await createPaymentIntent(currentPaymentRequest.amount);

      if (createResult.error || !createResult.paymentIntent) {
        throw new Error(createResult.error?.message || 'PaymentIntentの作成に失敗しました');
      }

      setCurrentPaymentIntent(createResult.paymentIntent);
      setStep('collecting');

      console.log('[Payment] Collecting payment method...');

      // カード情報を収集
      const collectResult = await collectPaymentMethod(createResult.paymentIntent);

      if (collectResult.error) {
        if (collectResult.error.code === 'Canceled') {
          setStep('cancelled');
          return;
        }
        throw new Error(collectResult.error.message);
      }

      if (!collectResult.paymentIntent) {
        throw new Error('カード情報の収集に失敗しました');
      }

      setStep('processing');

      console.log('[Payment] Processing payment...');

      // 決済を処理
      const processResult = await processPayment(collectResult.paymentIntent);

      if (processResult.error) {
        throw new Error(processResult.error.message);
      }

      // デバッグ: processResultの構造を確認
      console.log('[Payment] processResult.paymentIntent:', JSON.stringify(processResult.paymentIntent, null, 2));

      const finalPaymentIntentId = processResult.paymentIntent?.id || createResult.paymentIntent.id;

      // カード詳細を抽出（端末シリアル番号も含める）
      const cardDetails = extractCardDetails(
        processResult.paymentIntent,
        connectedReader?.serialNumber
      );

      console.log('[Payment] Card details extracted:', cardDetails);

      // 決済完了
      setStep('complete');
      completePayment(finalPaymentIntentId, cardDetails);

      console.log('[Payment] Payment completed:', finalPaymentIntentId);

    } catch (err) {
      console.error('[Payment] Payment error:', err);
      setError(err instanceof Error ? err.message : '決済処理に失敗しました');
      setStep('error');
    }
  }, [currentPaymentRequest, createPaymentIntent, collectPaymentMethod, processPayment, completePayment]);

  // 決済リクエストがない場合は戻る
  useEffect(() => {
    if (!currentPaymentRequest) {
      safeGoBack();
    }
  }, [currentPaymentRequest]);

  // 自動で決済を開始
  useEffect(() => {
    if (currentPaymentRequest && connectedReader && step === 'ready' && !hasStartedRef.current) {
      hasStartedRef.current = true;
      console.log('[Payment] Auto-starting payment process');
      handleStartPayment();
    }
  }, [currentPaymentRequest, connectedReader, step, handleStartPayment]);

  // リーダー未接続の場合
  if (!connectedReader) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="wifi.exclamationmark" size={64} color="#FF9500" />
          <ThemedText type="title" style={styles.errorTitle}>
            リーダー未接続
          </ThemedText>
          <ThemedText style={styles.errorDescription}>
            決済を行うにはカードリーダーを接続してください
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={() => router.replace('/reader-setup')}
          >
            <ThemedText style={styles.buttonText}>リーダーを接続</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // 決済リクエストがない場合
  if (!currentPaymentRequest) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={64} color="#FF9500" />
          <ThemedText type="title" style={styles.errorTitle}>
            決済リクエストなし
          </ThemedText>
          <ThemedText style={styles.errorDescription}>
            POSからの決済リクエストがありません
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={safeGoBack}
          >
            <ThemedText style={styles.buttonText}>戻る</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // 決済をキャンセル
  const handleCancelPayment = async () => {
    try {
      if (step === 'collecting') {
        await cancelCollectPaymentMethod();
      }

      cancelPayment();
      safeGoBack();
    } catch (err) {
      console.error('Cancel error:', err);
      cancelPayment();
      safeGoBack();
    }
  };

  // 完了後に閉じる
  const handleClose = () => {
    safeGoBack();
  };

  // 準備完了画面（自動開始するので短時間しか表示されない）
  if (step === 'ready') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText type="title" style={styles.processingTitle}>
            決済準備中...
          </ThemedText>
          <View style={styles.amountBadge}>
            <ThemedText style={styles.amountBadgeText}>
              {currentPaymentRequest.amount.toLocaleString()} 円
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    );
  }

  // PaymentIntent作成中
  if (step === 'creating') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText type="title" style={styles.processingTitle}>
            準備中...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // カード収集中
  if (step === 'collecting') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <View style={styles.cardIconContainer}>
            <IconSymbol name="creditcard.fill" size={80} color="#007AFF" />
          </View>
          <ThemedText type="title" style={styles.processingTitle}>
            カードをタッチ
          </ThemedText>
          <ThemedText style={styles.processingDescription}>
            リーダーにカードをタッチまたは挿入してください
          </ThemedText>

          <View style={styles.amountBadge}>
            <ThemedText style={styles.amountBadgeText}>
              {currentPaymentRequest.amount.toLocaleString()} 円
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { marginTop: 48 }]}
            onPress={handleCancelPayment}
          >
            <ThemedText style={styles.cancelButtonText}>キャンセル</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // 処理中
  if (step === 'processing') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText type="title" style={styles.processingTitle}>
            決済処理中...
          </ThemedText>
          <ThemedText style={styles.processingDescription}>
            カードを離さないでください
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // 完了
  if (step === 'complete') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="checkmark.circle.fill" size={80} color="#34C759" />
          <ThemedText type="title" style={styles.completeTitle}>
            決済完了
          </ThemedText>
          <ThemedText style={styles.completeAmount}>
            {currentPaymentRequest.amount.toLocaleString()} 円
          </ThemedText>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 48 }]}
            onPress={handleClose}
          >
            <ThemedText style={styles.buttonText}>閉じる</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // キャンセル
  if (step === 'cancelled') {
    const handleRetry = () => {
      hasStartedRef.current = false;
      setStep('ready');
    };

    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="xmark.circle.fill" size={80} color="#8E8E93" />
          <ThemedText type="title" style={styles.cancelledTitle}>
            キャンセルされました
          </ThemedText>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 48 }]}
            onPress={handleRetry}
          >
            <ThemedText style={styles.buttonText}>やり直す</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
          >
            <ThemedText style={styles.cancelButtonText}>閉じる</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // エラー
  if (step === 'error') {
    const handleRetry = () => {
      hasStartedRef.current = false;
      setStep('ready');
    };

    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={80} color="#FF3B30" />
          <ThemedText type="title" style={styles.errorTitle}>
            エラー
          </ThemedText>
          <ThemedText style={styles.errorDescription}>{error}</ThemedText>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 48 }]}
            onPress={handleRetry}
          >
            <ThemedText style={styles.buttonText}>やり直す</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancelPayment}
          >
            <ThemedText style={styles.cancelButtonText}>決済をキャンセル</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8E8E93',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 18,
  },
  cardIconContainer: {
    marginBottom: 24,
  },
  processingTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  processingDescription: {
    marginTop: 8,
    opacity: 0.7,
    textAlign: 'center',
  },
  amountBadge: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
  },
  amountBadgeText: {
    fontSize: 20,
    fontWeight: '600',
  },
  completeTitle: {
    marginTop: 16,
    color: '#34C759',
  },
  completeAmount: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: 'bold',
  },
  cancelledTitle: {
    marginTop: 16,
    color: '#8E8E93',
  },
  errorTitle: {
    marginTop: 16,
    color: '#FF3B30',
  },
  errorDescription: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
});
