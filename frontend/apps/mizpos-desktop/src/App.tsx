import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { LoginScreen } from "./components/LoginScreen";
import { POSScreen } from "./components/POSScreen";
import { useAuthStore } from "./stores/auth";
import { useNetworkStore } from "./stores/network";

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
      <div
        className={css({
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a237e 0%, #3949ab 100%)",
        })}
      >
        <div className={css({ textAlign: "center", color: "white" })}>
          <h1
            className={css({
              fontSize: "48px",
              fontWeight: 700,
              margin: "0 0 16px 0",
            })}
          >
            mizPOS
          </h1>
          <p className={css({ fontSize: "18px", opacity: 0.8, margin: 0 })}>
            起動中...
          </p>
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
