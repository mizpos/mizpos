/**
 * ペアリングモーダル
 *
 * QRコードまたはPNRでmizpos-desktopとペアリング
 */

import { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePairing } from '@/providers';

type PairingMode = 'qr' | 'pnr';

export default function PairingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<PairingMode>('qr');
  const [pnrInput, setPnrInput] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  const { isPaired, pairingInfo, pairWithQRCode, pairWithPNR, unpair, error, clearError } =
    usePairing();

  // QRコードスキャン処理
  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);

    try {
      await pairWithQRCode(data);
      if (!error) {
        router.back();
      }
    } finally {
      setIsScanning(true);
    }
  };

  // PNRでペアリング
  const handlePnrPairing = async () => {
    if (!pnrInput.trim()) {
      Alert.alert('エラー', 'PNRを入力してください');
      return;
    }

    await pairWithPNR(pnrInput.trim());
    if (!error) {
      router.back();
    }
  };

  // ペアリング解除
  const handleUnpair = () => {
    Alert.alert(
      'ペアリングを解除',
      '本当にPOSとのペアリングを解除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除',
          style: 'destructive',
          onPress: () => {
            unpair();
          },
        },
      ]
    );
  };

  // ペアリング済みの場合
  if (isPaired && pairingInfo) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.pairedContainer}>
          <View style={styles.pairedIcon}>
            <IconSymbol name="link.circle.fill" size={64} color="#34C759" />
          </View>

          <ThemedText type="title" style={styles.pairedTitle}>
            ペアリング済み
          </ThemedText>

          <View style={styles.pairedInfoCard}>
            <View style={styles.pairedInfoRow}>
              <ThemedText style={styles.pairedInfoLabel}>POS端末</ThemedText>
              <ThemedText style={styles.pairedInfoValue}>{pairingInfo.posName}</ThemedText>
            </View>
            <View style={styles.pairedInfoRow}>
              <ThemedText style={styles.pairedInfoLabel}>PNR</ThemedText>
              <ThemedText style={styles.pairedInfoValue}>{pairingInfo.pnr}</ThemedText>
            </View>
            {pairingInfo.eventName && (
              <View style={styles.pairedInfoRow}>
                <ThemedText style={styles.pairedInfoLabel}>イベント</ThemedText>
                <ThemedText style={styles.pairedInfoValue}>{pairingInfo.eventName}</ThemedText>
              </View>
            )}
            <View style={styles.pairedInfoRow}>
              <ThemedText style={styles.pairedInfoLabel}>接続日時</ThemedText>
              <ThemedText style={styles.pairedInfoValue}>
                {pairingInfo.pairedAt.toLocaleString('ja-JP')}
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={styles.unpairButton}
            onPress={handleUnpair}
          >
            <IconSymbol name="link" size={20} color="#FF3B30" />
            <ThemedText style={styles.unpairButtonText}>ペアリングを解除</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // カメラ権限リクエスト
  if (!permission && mode === 'qr') {
    return <View />;
  }

  return (
    <ThemedView style={styles.container}>
      {/* エラー表示 */}
      {error && (
        <View style={styles.errorBanner}>
          <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FF3B30" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity onPress={clearError}>
            <IconSymbol name="xmark" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      {/* モード切り替えタブ */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, mode === 'qr' && styles.tabActive]}
          onPress={() => setMode('qr')}
        >
          <IconSymbol
            name="qrcode.viewfinder"
            size={20}
            color={mode === 'qr' ? '#007AFF' : '#8E8E93'}
          />
          <ThemedText style={[styles.tabText, mode === 'qr' && styles.tabTextActive]}>
            QRコード
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'pnr' && styles.tabActive]}
          onPress={() => setMode('pnr')}
        >
          <IconSymbol
            name="textformat.123"
            size={20}
            color={mode === 'pnr' ? '#007AFF' : '#8E8E93'}
          />
          <ThemedText style={[styles.tabText, mode === 'pnr' && styles.tabTextActive]}>
            PNR入力
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* QRコードスキャン */}
      {mode === 'qr' && (
        <>
          {!permission?.granted ? (
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
          ) : (
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
              <View style={styles.scanInfo}>
                <ThemedText type="subtitle">POSのQRコードをスキャン</ThemedText>
                <ThemedText style={styles.scanDescription}>
                  mizpos-desktop で表示されるペアリング用QRコードをスキャンしてください
                </ThemedText>
              </View>
            </View>
          )}
        </>
      )}

      {/* PNR入力 */}
      {mode === 'pnr' && (
        <View style={styles.pnrContainer}>
          <IconSymbol name="keyboard" size={48} color="#007AFF" />
          <ThemedText type="subtitle" style={styles.pnrTitle}>
            PNRを入力
          </ThemedText>
          <ThemedText style={styles.pnrDescription}>
            mizpos-desktop で表示される6桁のペアリング番号を入力してください
          </ThemedText>

          <TextInput
            style={[styles.pnrInput, { color: colors.text, borderColor: colors.text }]}
            value={pnrInput}
            onChangeText={(text) => {
              // 数字のみ、6桁まで
              const filtered = text.replace(/[^0-9]/g, '').slice(0, 6);
              setPnrInput(filtered);
            }}
            placeholder="000000"
            placeholderTextColor="#8E8E93"
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: pnrInput.length === 6 ? '#007AFF' : '#E5E5E5' },
            ]}
            onPress={handlePnrPairing}
            disabled={pnrInput.length !== 6}
          >
            <ThemedText
              style={[
                styles.buttonText,
                { color: pnrInput.length === 6 ? '#FFFFFF' : '#8E8E93' },
              ]}
            >
              ペアリング
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#E5F0FF',
  },
  tabText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
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
  },
  camera: {
    flex: 1,
    maxHeight: 400,
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
  pnrContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  pnrTitle: {
    marginTop: 8,
  },
  pnrDescription: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 16,
  },
  pnrInput: {
    width: '100%',
    maxWidth: 200,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  button: {
    width: '100%',
    maxWidth: 200,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pairedContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  pairedIcon: {
    marginTop: 32,
  },
  pairedTitle: {
    color: '#34C759',
  },
  pairedInfoCard: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 16,
  },
  pairedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pairedInfoLabel: {
    opacity: 0.7,
  },
  pairedInfoValue: {
    fontWeight: '500',
  },
  unpairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
    marginTop: 24,
  },
  unpairButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
});
