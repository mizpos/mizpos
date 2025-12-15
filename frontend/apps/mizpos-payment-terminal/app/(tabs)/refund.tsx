/**
 * 返金タブ画面
 *
 * QRコードをスキャンして返金処理を開始
 */

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPaymentIntent, createRefund, PaymentIntentForRefund } from '@/services/api';

type RefundStep = 'scan' | 'confirm' | 'processing' | 'complete' | 'error';

export default function RefundScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<RefundStep>('scan');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<PaymentIntentForRefund | null>(null);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  // QRコードスキャン処理
  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);

    // QRコードのフォーマット: pi_xxxx or mizpos://refund?pi=pi_xxxx
    let piId = data;
    if (data.startsWith('mizpos://refund')) {
      const url = new URL(data.replace('mizpos://', 'https://'));
      piId = url.searchParams.get('pi') || '';
    }

    if (piId.startsWith('pi_')) {
      await fetchPaymentInfo(piId);
    } else {
      setError('無効なQRコードです');
      setStep('error');
    }
  };

  // PaymentIntent情報を取得
  const fetchPaymentInfo = async (piId: string) => {
    try {
      setPaymentIntentId(piId);
      const info = await getPaymentIntent(piId);

      if (!info.refundable) {
        setError('この決済は返金できません');
        setStep('error');
        return;
      }

      setPaymentInfo(info);
      setRefundAmount(info.amount);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : '情報の取得に失敗しました');
      setStep('error');
    }
  };

  // 手動入力で検索
  const handleManualSearch = async () => {
    if (!manualInput.trim()) {
      Alert.alert('エラー', 'PaymentIntent IDを入力してください');
      return;
    }
    await fetchPaymentInfo(manualInput.trim());
  };

  // 返金を実行
  const handleRefund = async () => {
    if (!paymentIntentId || !paymentInfo) return;

    try {
      setStep('processing');

      const refund = await createRefund({
        payment_intent_id: paymentIntentId,
        amount: refundAmount === paymentInfo.amount ? undefined : refundAmount || undefined,
      });

      if (refund.status === 'succeeded') {
        setStep('complete');
      } else {
        setError(`返金ステータス: ${refund.status}`);
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '返金処理に失敗しました');
      setStep('error');
    }
  };

  // リセット
  const handleReset = () => {
    setStep('scan');
    setPaymentIntentId('');
    setManualInput('');
    setPaymentInfo(null);
    setRefundAmount(null);
    setError(null);
    setIsScanning(true);
  };

  // カメラ権限リクエスト
  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.permissionContainer}>
          <IconSymbol name="camera.fill" size={48} color="#8E8E93" />
          <ThemedText style={styles.permissionText}>
            QRコードをスキャンするにはカメラへのアクセスが必要です
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF' }]}
            onPress={requestPermission}
          >
            <ThemedText style={styles.buttonText}>カメラを許可</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // スキャン画面
  if (step === 'scan') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
            </View>
          </CameraView>
        </View>

        <View style={styles.scanInfo}>
          <ThemedText type="subtitle">レシートのQRコードをスキャン</ThemedText>
          <ThemedText style={styles.scanDescription}>
            返金対象の決済レシートにあるQRコードをスキャンしてください
          </ThemedText>
        </View>

        <View style={styles.manualInputContainer}>
          <ThemedText type="subtitle" style={styles.manualInputLabel}>
            または手動で入力
          </ThemedText>
          <View style={styles.manualInputRow}>
            <TextInput
              style={[styles.textInput, { color: colors.text, borderColor: colors.text }]}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="pi_xxxxxxxxxxxx"
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: '#007AFF' }]}
              onPress={handleManualSearch}
            >
              <IconSymbol name="magnifyingglass" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    );
  }

  // 確認画面
  if (step === 'confirm' && paymentInfo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.confirmContainer}>
        <View style={styles.amountCard}>
          <ThemedText style={styles.amountLabel}>返金対象金額</ThemedText>
          <ThemedText style={styles.amount}>
            {paymentInfo.amount.toLocaleString()} 円
          </ThemedText>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>決済ID</ThemedText>
            <ThemedText style={styles.infoValue}>{paymentInfo.id}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>ステータス</ThemedText>
            <ThemedText style={styles.infoValue}>{paymentInfo.status}</ThemedText>
          </View>
        </View>

        <View style={styles.refundAmountContainer}>
          <ThemedText type="subtitle">返金額</ThemedText>
          <View style={styles.refundAmountInputContainer}>
            <TextInput
              style={[styles.refundAmountInput, { color: colors.text }]}
              value={refundAmount?.toString() || ''}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num > 0 && num <= paymentInfo.amount) {
                  setRefundAmount(num);
                } else if (text === '') {
                  setRefundAmount(null);
                }
              }}
              keyboardType="numeric"
              placeholder={paymentInfo.amount.toString()}
            />
            <ThemedText style={styles.currency}>円</ThemedText>
          </View>
          <TouchableOpacity onPress={() => setRefundAmount(paymentInfo.amount)}>
            <ThemedText style={styles.fullRefundLink}>全額返金</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#FF3B30' }]}
            onPress={handleRefund}
          >
            <IconSymbol name="arrow.uturn.backward.circle.fill" size={24} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>返金を実行</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleReset}
          >
            <ThemedText style={styles.cancelButtonText}>キャンセル</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // 処理中画面
  if (step === 'processing') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={64} color="#007AFF" />
          <ThemedText type="title" style={styles.processingText}>
            返金処理中...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // 完了画面
  if (step === 'complete') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="checkmark.circle.fill" size={64} color="#34C759" />
          <ThemedText type="title" style={styles.completeText}>
            返金完了
          </ThemedText>
          <ThemedText style={styles.completeDescription}>
            {refundAmount?.toLocaleString() || paymentInfo?.amount.toLocaleString()} 円
          </ThemedText>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF', marginTop: 32 }]}
            onPress={handleReset}
          >
            <ThemedText style={styles.buttonText}>新しい返金を開始</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // エラー画面
  if (step === 'error') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <IconSymbol name="xmark.circle.fill" size={64} color="#FF3B30" />
          <ThemedText type="title" style={styles.errorText}>
            エラー
          </ThemedText>
          <ThemedText style={styles.errorDescription}>{error}</ThemedText>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007AFF', marginTop: 32 }]}
            onPress={handleReset}
          >
            <ThemedText style={styles.buttonText}>やり直す</ThemedText>
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
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionText: {
    textAlign: 'center',
    fontSize: 16,
  },
  scannerContainer: {
    flex: 1,
    maxHeight: 400,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanInfo: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  scanDescription: {
    textAlign: 'center',
    opacity: 0.7,
  },
  manualInputContainer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  manualInputLabel: {
    marginBottom: 12,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmContainer: {
    padding: 24,
    gap: 24,
  },
  amountCard: {
    backgroundColor: '#F5F5F5',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    opacity: 0.7,
  },
  infoValue: {
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  refundAmountContainer: {
    gap: 8,
  },
  refundAmountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refundAmountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  currency: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullRefundLink: {
    color: '#007AFF',
    textAlign: 'right',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8E8E93',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 18,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  processingText: {
    marginTop: 16,
  },
  completeText: {
    marginTop: 16,
    color: '#34C759',
  },
  completeDescription: {
    fontSize: 24,
    marginTop: 8,
  },
  errorText: {
    marginTop: 16,
    color: '#FF3B30',
  },
  errorDescription: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
});
