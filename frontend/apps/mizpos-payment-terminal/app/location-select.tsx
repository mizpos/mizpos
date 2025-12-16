/**
 * 店舗選択画面
 *
 * ペアリング成功後に表示される店舗選択画面
 * Stripe Terminalのリーダーを使用するLocationを選択する
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useLocation } from '@/providers/LocationProvider';
import { type TerminalLocation } from '@/services/api';

export default function LocationSelectScreen() {
  const router = useRouter();
  const colors = {
    background: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    tint: useThemeColor({}, 'tint'),
  };

  const {
    locations,
    isLoadingLocations,
    loadLocationsError,
    loadLocations,
    selectLocation,
    selectedLocation,
  } = useLocation();

  // 画面表示時に店舗一覧を取得
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // 店舗を選択
  const handleSelectLocation = async (location: TerminalLocation) => {
    try {
      await selectLocation(location);
      // リーダー設定画面へ遷移
      router.replace('/reader-setup');
    } catch (error) {
      console.error('Failed to select location:', error);
    }
  };

  // 店舗アイテムをレンダリング
  const renderLocationItem = ({ item }: { item: TerminalLocation }) => {
    const isSelected = selectedLocation?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.locationItem,
          { backgroundColor: isSelected ? colors.tint + '20' : colors.background },
          { borderColor: isSelected ? colors.tint : '#ddd' },
        ]}
        onPress={() => handleSelectLocation(item)}
      >
        <View style={styles.locationInfo}>
          <Text style={[styles.locationName, { color: colors.text }]}>
            {item.display_name}
          </Text>
          {item.address && (
            <Text style={[styles.locationAddress, { color: colors.text + '99' }]}>
              {item.address.line1}
              {item.address.city && `, ${item.address.city}`}
            </Text>
          )}
        </View>
        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.tint }]}>
            <Text style={styles.selectedBadgeText}>選択中</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>店舗を選択</Text>
        <Text style={[styles.subtitle, { color: colors.text + '99' }]}>
          決済端末を使用する店舗を選択してください
        </Text>
      </View>

      {isLoadingLocations ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            店舗を読み込み中...
          </Text>
        </View>
      ) : loadLocationsError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loadLocationsError}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={loadLocations}
          >
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : locations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            利用可能な店舗がありません
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text + '99' }]}>
            Stripe Dashboardで店舗を設定してください
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={loadLocations}
          >
            <Text style={styles.retryButtonText}>再読み込み</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          renderItem={renderLocationItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  listContent: {
    padding: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
  },
  selectedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    height: 12,
  },
});
