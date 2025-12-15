/**
 * 決済ホーム画面
 *
 * - 端末接続状態の表示
 * - POSペアリング状態の表示
 * - 決済待機画面
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTerminal, usePairing } from '@/providers';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const {
    isInitialized,
    connectedReader,
    connectionError: terminalError,
  } = useTerminal();

  const { isPaired, pairingInfo, currentPaymentRequest } = usePairing();

  // 自動遷移用のref（二重遷移防止）
  const hasNavigatedRef = useRef<string | null>(null);

  // 決済リクエストが来たら自動で決済画面に遷移
  useEffect(() => {
    const canAcceptPayment = isInitialized && connectedReader && isPaired;

    if (currentPaymentRequest && canAcceptPayment) {
      // 同じリクエストで二重遷移しない
      if (hasNavigatedRef.current !== currentPaymentRequest.id) {
        hasNavigatedRef.current = currentPaymentRequest.id;
        console.log('[Home] Auto-navigating to payment screen for request:', currentPaymentRequest.id);
        router.push('/payment');
      }
    } else {
      // リクエストがなくなったらリセット
      hasNavigatedRef.current = null;
    }
  }, [currentPaymentRequest, isInitialized, connectedReader, isPaired]);

  // 端末接続ステータス
  const renderReaderStatus = () => {
    if (!isInitialized) {
      return (
        <View style={[styles.statusCard, { backgroundColor: colors.background }]}>
          <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#FFA500" />
          <View style={styles.statusTextContainer}>
            <ThemedText type="subtitle">Terminal SDK</ThemedText>
            <ThemedText style={styles.statusDescription}>初期化中...</ThemedText>
          </View>
        </View>
      );
    }

    if (terminalError) {
      return (
        <View style={[styles.statusCard, { backgroundColor: colors.background }]}>
          <IconSymbol name="xmark.circle.fill" size={24} color="#FF3B30" />
          <View style={styles.statusTextContainer}>
            <ThemedText type="subtitle">エラー</ThemedText>
            <ThemedText style={styles.statusDescription}>{terminalError}</ThemedText>
          </View>
        </View>
      );
    }

    if (connectedReader) {
      return (
        <TouchableOpacity
          style={[styles.statusCard, styles.statusCardConnected]}
          onPress={() => router.push('/reader-setup')}
        >
          <IconSymbol name="checkmark.circle.fill" size={24} color="#34C759" />
          <View style={styles.statusTextContainer}>
            <ThemedText type="subtitle" lightColor="#11181C" darkColor="#11181C">
              リーダー接続済み
            </ThemedText>
            <ThemedText style={styles.statusDescription} lightColor="#11181C" darkColor="#11181C">
              {connectedReader.serialNumber || 'シリアル番号不明'}
            </ThemedText>
          </View>
          <IconSymbol name="chevron.right" size={20} color="#11181C" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.statusCard, { backgroundColor: colors.background }]}
        onPress={() => router.push('/reader-setup')}
      >
        <IconSymbol name="wifi.exclamationmark" size={24} color="#FF9500" />
        <View style={styles.statusTextContainer}>
          <ThemedText type="subtitle">リーダー未接続</ThemedText>
          <ThemedText style={styles.statusDescription}>タップして接続</ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.text} />
      </TouchableOpacity>
    );
  };

  // ペアリングステータス
  const renderPairingStatus = () => {
    if (isPaired && pairingInfo) {
      return (
        <TouchableOpacity
          style={[styles.statusCard, styles.statusCardConnected]}
          onPress={() => router.push('/pairing')}
        >
          <IconSymbol name="link.circle.fill" size={24} color="#007AFF" />
          <View style={styles.statusTextContainer}>
            <ThemedText type="subtitle" lightColor="#11181C" darkColor="#11181C">
              POS連携中
            </ThemedText>
            <ThemedText style={styles.statusDescription} lightColor="#11181C" darkColor="#11181C">
              {pairingInfo.posName} (PIN: {pairingInfo.pinCode})
            </ThemedText>
          </View>
          <IconSymbol name="chevron.right" size={20} color="#11181C" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.statusCard, { backgroundColor: colors.background }]}
        onPress={() => router.push('/pairing')}
      >
        <IconSymbol name="qrcode.viewfinder" size={24} color="#8E8E93" />
        <View style={styles.statusTextContainer}>
          <ThemedText type="subtitle">POS未連携</ThemedText>
          <ThemedText style={styles.statusDescription}>タップしてペアリング</ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.text} />
      </TouchableOpacity>
    );
  };

  // 決済待機画面
  const renderPaymentArea = () => {
    const canAcceptPayment = isInitialized && connectedReader && isPaired;

    if (currentPaymentRequest) {
      // 決済リクエストがある場合
      return (
        <View style={styles.paymentArea}>
          <ThemedText type="title" style={styles.paymentAmountLabel}>
            お支払い金額
          </ThemedText>
          <ThemedText style={styles.paymentAmount}>
            {currentPaymentRequest.amount.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.paymentCurrency}>円</ThemedText>

          <TouchableOpacity
            style={[styles.paymentButton, { backgroundColor: '#34C759' }]}
            onPress={() => router.push('/payment')}
          >
            <IconSymbol name="creditcard.fill" size={24} color="#FFFFFF" />
            <ThemedText style={styles.paymentButtonText}>決済を開始</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (!canAcceptPayment) {
      return (
        <View style={styles.paymentArea}>
          <IconSymbol name="hourglass" size={48} color="#8E8E93" />
          <ThemedText style={styles.waitingText}>
            決済を開始するには、リーダーとPOSの接続が必要です
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.paymentArea}>
        <IconSymbol name="clock.fill" size={48} color="#007AFF" />
        <ThemedText style={styles.waitingText}>決済待機中</ThemedText>
        <ThemedText style={styles.waitingDescription}>
          POSからの決済リクエストを待っています
        </ThemedText>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          接続状況
        </ThemedText>
        {renderReaderStatus()}
        {renderPairingStatus()}
      </ThemedView>

      <ThemedView style={styles.section}>
        {renderPaymentArea()}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusCardConnected: {
    backgroundColor: '#E8F5E9',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  paymentArea: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 300,
    gap: 16,
  },
  paymentAmountLabel: {
    fontSize: 18,
    opacity: 0.7,
  },
  paymentAmount: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  paymentCurrency: {
    fontSize: 24,
    opacity: 0.7,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  waitingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  waitingDescription: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});
