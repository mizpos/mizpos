/**
 * mizPOS Desktop アプリケーション
 * POS端末向けTauriアプリ
 */

import { useEffect, useState } from "react";
import { LoginScreen, POSScreen } from "./components";
import { useAuthStore } from "./stores/auth";
import { useNetworkStore } from "./stores/network";
import "./App.css";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { session, initialize } = useAuthStore();
  const { startMonitoring, stopMonitoring } = useNetworkStore();

  // アプリ初期化
  useEffect(() => {
    const init = async () => {
      await initialize();
      setIsInitialized(true);
    };
    init();
  }, [initialize]);

  // ネットワーク監視
  useEffect(() => {
    startMonitoring();
    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  // 初期化中
  if (!isInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-content">
          <h1>mizPOS</h1>
          <p>起動中...</p>
        </div>
      </div>
    );
  }

  // 未ログイン
  if (!session) {
    return <LoginScreen />;
  }

  // メイン画面
  return <POSScreen />;
}

export default App;
