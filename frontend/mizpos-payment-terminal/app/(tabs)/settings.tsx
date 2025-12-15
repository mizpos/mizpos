/**
 * 設定画面
 *
 * - 端末情報
 * - 接続設定
 * - アプリ情報
 */

import { StyleSheet, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTerminal, usePairing } from '@/providers';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { isInitialized, connectedReader, disconnectReader } = useTerminal();
  const { isPaired, pairingInfo, unpair } = usePairing();

  // リーダー切断
  const handleDisconnectReader = () => {
    Alert.alert(
      'リーダーを切断',
      '本当にリーダーとの接続を切断しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '切断',
          style: 'destructive',
          onPress: async () => {
            await disconnectReader();
          },
        },
      ]
    );
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

  // 設定項目を描画
  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    destructive?: boolean
  ) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: colors.background }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <IconSymbol
        name={icon as any}
        size={24}
        color={destructive ? '#FF3B30' : '#007AFF'}
      />
      <View style={styles.settingTextContainer}>
        <ThemedText
          style={[styles.settingTitle, destructive && styles.destructiveText]}
        >
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText style={styles.settingSubtitle}>{subtitle}</ThemedText>
        )}
      </View>
      {onPress && (
        <IconSymbol name="chevron.right" size={20} color={colors.text} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* 端末接続 */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          カードリーダー
        </ThemedText>

        {connectedReader ? (
          <>
            {renderSettingItem(
              'checkmark.circle.fill',
              'リーダー接続済み',
              connectedReader.serialNumber || '詳細情報なし'
            )}
            {renderSettingItem(
              'wifi.slash',
              'リーダーを切断',
              undefined,
              handleDisconnectReader,
              true
            )}
          </>
        ) : (
          renderSettingItem(
            'wifi.exclamationmark',
            'リーダーを接続',
            'Bluetooth でリーダーを検出',
            () => router.push('/reader-setup')
          )
        )}
      </View>

      {/* POS連携 */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          POS連携
        </ThemedText>

        {isPaired && pairingInfo ? (
          <>
            {renderSettingItem(
              'link.circle.fill',
              '連携中のPOS',
              `${pairingInfo.posName} (PNR: ${pairingInfo.pnr})`
            )}
            {pairingInfo.eventName &&
              renderSettingItem('calendar', 'イベント', pairingInfo.eventName)}
            {renderSettingItem(
              'link.badge.minus',
              'ペアリングを解除',
              undefined,
              handleUnpair,
              true
            )}
          </>
        ) : (
          renderSettingItem(
            'qrcode.viewfinder',
            'POSとペアリング',
            'QRコードまたはPNRで連携',
            () => router.push('/pairing')
          )
        )}
      </View>

      {/* システム情報 */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          システム情報
        </ThemedText>

        {renderSettingItem(
          'info.circle',
          'Terminal SDK',
          isInitialized ? '初期化済み' : '初期化中...'
        )}
        {renderSettingItem(
          'app.badge',
          'アプリバージョン',
          '1.0.0'
        )}
      </View>

      {/* サポート */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          サポート
        </ThemedText>

        {renderSettingItem(
          'questionmark.circle',
          'ヘルプ',
          '使い方・FAQ',
          () => Alert.alert('ヘルプ', '準備中です')
        )}
        {renderSettingItem(
          'envelope',
          'お問い合わせ',
          undefined,
          () => Alert.alert('お問い合わせ', '準備中です')
        )}
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>mizPOS Terminal</ThemedText>
        <ThemedText style={styles.footerText}>Powered by Stripe Terminal</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    marginBottom: 8,
    opacity: 0.7,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  destructiveText: {
    color: '#FF3B30',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
  },
});
