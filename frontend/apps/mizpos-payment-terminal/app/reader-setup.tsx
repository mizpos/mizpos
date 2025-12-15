/**
 * リーダー設定モーダル
 *
 * Bluetooth でリーダーを検出・接続
 */

import { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Reader } from '@stripe/stripe-terminal-react-native';

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
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTerminal } from '@/providers';

export default function ReaderSetupScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const {
    isInitialized,
    connectedReader,
    isConnecting,
    connectionError,
    discoveredReaders,
    discoverReaders,
    connectReader,
    disconnectReader,
  } = useTerminal();

  const [isDiscovering, setIsDiscovering] = useState(false);

  // リーダーを検出開始
  const handleDiscoverReaders = async () => {
    setIsDiscovering(true);
    try {
      await discoverReaders();
    } finally {
      setIsDiscovering(false);
    }
  };

  // リーダーに接続
  const handleConnectReader = async (reader: Reader.Type) => {
    await connectReader(reader);
    if (!connectionError) {
      safeGoBack();
    }
  };

  // リーダーを切断
  const handleDisconnectReader = async () => {
    await disconnectReader();
  };

  // リーダーアイテムを描画
  const renderReaderItem = ({ item }: { item: Reader.Type }) => {
    const isConnected = connectedReader?.serialNumber === item.serialNumber;

    return (
      <TouchableOpacity
        style={[
          styles.readerItem,
          { backgroundColor: colors.background },
          isConnected && styles.readerItemConnected,
        ]}
        onPress={() => !isConnected && handleConnectReader(item)}
        disabled={isConnecting || isConnected}
      >
        <View style={styles.readerIcon}>
          <IconSymbol
            name={isConnected ? 'checkmark.circle.fill' : 'creditcard.fill'}
            size={32}
            color={isConnected ? '#34C759' : '#007AFF'}
          />
        </View>
        <View style={styles.readerInfo}>
          <ThemedText style={styles.readerName}>
            {item.label || item.deviceType || 'Unknown Reader'}
          </ThemedText>
          <ThemedText style={styles.readerSerial}>
            S/N: {item.serialNumber || 'N/A'}
          </ThemedText>
          <View style={styles.readerStatus}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? '#34C759' : '#8E8E93' },
              ]}
            />
            <ThemedText style={styles.statusText}>
              {isConnected ? '接続済み' : item.status || '利用可能'}
            </ThemedText>
          </View>
        </View>
        {isConnecting && !isConnected && (
          <ActivityIndicator size="small" color="#007AFF" />
        )}
      </TouchableOpacity>
    );
  };

  // 接続済みリーダー表示
  const renderConnectedReader = () => {
    if (!connectedReader) return null;

    return (
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          接続中のリーダー
        </ThemedText>
        <View
          style={[styles.readerItem, styles.readerItemConnected, { backgroundColor: colors.background }]}
        >
          <View style={styles.readerIcon}>
            <IconSymbol name="checkmark.circle.fill" size={32} color="#34C759" />
          </View>
          <View style={styles.readerInfo}>
            <ThemedText style={styles.readerName}>
              {connectedReader.label || connectedReader.deviceType || 'Unknown Reader'}
            </ThemedText>
            <ThemedText style={styles.readerSerial}>
              S/N: {connectedReader.serialNumber || 'N/A'}
            </ThemedText>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.disconnectButton]}
          onPress={handleDisconnectReader}
        >
          <IconSymbol name="wifi.slash" size={20} color="#FF3B30" />
          <ThemedText style={styles.disconnectButtonText}>切断</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  // 未初期化状態
  if (!isInitialized) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.initializingText}>
            Terminal SDK を初期化中...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* エラー表示 */}
      {connectionError && (
        <View style={styles.errorBanner}>
          <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FF3B30" />
          <ThemedText style={styles.errorText}>{connectionError}</ThemedText>
        </View>
      )}

      {/* 接続済みリーダー */}
      {renderConnectedReader()}

      {/* 検出ボタン */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          リーダーを検出
        </ThemedText>
        <TouchableOpacity
          style={[styles.discoverButton, { backgroundColor: '#007AFF' }]}
          onPress={handleDiscoverReaders}
          disabled={isDiscovering}
        >
          {isDiscovering ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <IconSymbol name="antenna.radiowaves.left.and.right" size={24} color="#FFFFFF" />
          )}
          <ThemedText style={styles.discoverButtonText}>
            {isDiscovering ? 'スキャン中...' : 'Bluetooth でスキャン'}
          </ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.discoverHint}>
          リーダーの電源が入っていることを確認し、ペアリングモードにしてください
        </ThemedText>
      </View>

      {/* 検出されたリーダー一覧 */}
      {discoveredReaders.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            検出されたリーダー ({discoveredReaders.length})
          </ThemedText>
          <FlatList
            data={discoveredReaders}
            keyExtractor={(item) => item.serialNumber || item.id || Math.random().toString()}
            renderItem={renderReaderItem}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* 空状態 */}
      {!isDiscovering && discoveredReaders.length === 0 && !connectedReader && (
        <View style={styles.emptyState}>
          <IconSymbol name="wifi.exclamationmark" size={48} color="#8E8E93" />
          <ThemedText style={styles.emptyStateText}>
            リーダーが見つかりません
          </ThemedText>
          <ThemedText style={styles.emptyStateHint}>
            上のボタンをタップしてスキャンを開始してください
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  initializingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF0F0',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#FF3B30',
    fontSize: 14,
  },
  section: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    opacity: 0.7,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  discoverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  discoverHint: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
  readerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  readerItemConnected: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  readerIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerInfo: {
    flex: 1,
  },
  readerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  readerSerial: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  readerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    opacity: 0.7,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
  },
  disconnectButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateHint: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
