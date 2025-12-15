/**
 * 決済処理モーダル
 *
 * カード決済の実行とステータス表示
 */

import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { PaymentIntent } from '@stripe/stripe-terminal-react-native';

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

  // 決済リクエストがない場合は戻る
  useEffect(() => {
    if (!currentPaymentRequest) {
      safeGoBack();
    }
  }, [currentPaymentRequest]);

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

  // 決済を開始
  const handleStartPayment = async () => {
    try {
      setStep('creating');
      setError(null);

      // PaymentIntentをSDKで作成
      const createResult = await createPaymentIntent(currentPaymentRequest.amount);

      if (createResult.error || !createResult.paymentIntent) {
        throw new Error(createResult.error?.message || 'PaymentIntentの作成に失敗しました');
      }

      setCurrentPaymentIntent(createResult.paymentIntent);
      setStep('collecting');

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

      // 決済を処理
      const processResult = await processPayment(collectResult.paymentIntent);

      if (processResult.error) {
        throw new Error(processResult.error.message);
      }

      const finalPaymentIntentId = processResult.paymentIntent?.id || createResult.paymentIntent.id;

      // 決済完了
      setStep('complete');
      completePayment(finalPaymentIntentId);

    } catch (err) {
      setError(err instanceof Error ? err.message : '決済処理に失敗しました');
      setStep('error');
    }
  };

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

  // 準備完了画面
  if (step === 'ready') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.amountContainer}>
          <ThemedText style={styles.amountLabel}>お支払い金額</ThemedText>
          <ThemedText style={styles.amount}>
            {currentPaymentRequest.amount.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.currency}>円</ThemedText>
        </View>

        <View style={styles.readerInfo}>
          <IconSymbol name="creditcard.fill" size={24} color="#34C759" />
          <ThemedText style={styles.readerInfoText}>
            {connectedReader.label || connectedReader.deviceType || 'リーダー'} に接続中
          </ThemedText>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleStartPayment}
          >
            <IconSymbol name="creditcard.fill" size={24} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>カードで支払う</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancelPayment}
          >
            <ThemedText style={styles.cancelButtonText}>キャンセル</ThemedText>
          </TouchableOpacity>
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
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="xmark.circle.fill" size={80} color="#8E8E93" />
          <ThemedText type="title" style={styles.cancelledTitle}>
            キャンセルされました
          </ThemedText>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 48 }]}
            onPress={() => setStep('ready')}
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
            onPress={() => setStep('ready')}
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
  amountContainer: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 32,
  },
  amountLabel: {
    fontSize: 16,
    opacity: 0.7,
  },
  amount: {
    fontSize: 72,
    fontWeight: 'bold',
    marginTop: 8,
  },
  currency: {
    fontSize: 24,
    opacity: 0.7,
    marginTop: 4,
  },
  readerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginHorizontal: 32,
    gap: 8,
  },
  readerInfoText: {
    fontSize: 14,
    color: '#34C759',
  },
  buttonContainer: {
    padding: 32,
    gap: 12,
    marginTop: 'auto',
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
