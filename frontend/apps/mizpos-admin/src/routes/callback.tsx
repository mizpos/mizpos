import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";

export const Route = createFileRoute("/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // URLのエラーパラメータをチェック
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    if (errorParam) {
      setError(
        errorDescription ||
          "認証エラーが発生しました。もう一度お試しください。",
      );
      return;
    }

    // Amplifyが自動的に認証トークンを処理するのを待つ
    // Hub eventsをリッスンして認証完了を検出
    const hubListener = Hub.listen("auth", (data) => {
      console.log("Auth event:", data.payload.event);
      if (data.payload.event === "signedIn") {
        console.log("SignedIn event detected, navigating to home");
        navigate({ to: "/" });
      }
    });

    // 認証セッションを確認
    const checkAuth = async () => {
      try {
        // まず少し待ってからチェック（Amplifyの処理を待つ）
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const session = await fetchAuthSession({ forceRefresh: true });
        console.log("Session check:", {
          hasAccessToken: !!session.tokens?.accessToken,
        });

        if (session.tokens?.accessToken) {
          // 認証成功、ホームにリダイレクト
          console.log("Access token found, navigating to home");
          navigate({ to: "/" });
        } else {
          // トークンがまだない場合は、もう少し待ってからリトライ
          console.log("No access token yet, retrying in 2 seconds");
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const retrySession = await fetchAuthSession({ forceRefresh: true });
          console.log("Retry session check:", {
            hasAccessToken: !!retrySession.tokens?.accessToken,
          });

          if (retrySession.tokens?.accessToken) {
            console.log("Access token found on retry, navigating to home");
            navigate({ to: "/" });
          } else {
            console.error("Failed to get access token after retry");
            setError("認証トークンの取得に失敗しました。");
          }
        }
      } catch (sessionError) {
        console.error("Session check error:", sessionError);
        setError(
          "認証処理中にエラーが発生しました。もう一度ログインしてください。",
        );
      }
    };

    checkAuth();

    // クリーンアップ
    return () => {
      hubListener();
    };
  }, [navigate]);

  return (
    <div
      className={css({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "gray.100",
        padding: "4",
      })}
    >
      <div
        className={css({
          backgroundColor: "white",
          padding: "8",
          borderRadius: "lg",
          boxShadow: "lg",
          width: "100%",
          maxWidth: "md",
          textAlign: "center",
        })}
      >
        <h1
          className={css({
            fontSize: "2xl",
            fontWeight: "bold",
            color: "gray.900",
            marginBottom: "4",
          })}
        >
          {error ? "エラー" : "ログイン処理中..."}
        </h1>
        {error ? (
          <div>
            <p
              className={css({
                color: "red.600",
                marginBottom: "4",
              })}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className={css({
                backgroundColor: "primary.500",
                color: "white",
                padding: "2 4",
                borderRadius: "md",
                _hover: {
                  backgroundColor: "primary.600",
                },
              })}
            >
              ログインページに戻る
            </button>
          </div>
        ) : (
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "2",
            })}
          >
            <div
              className={css({
                width: "8",
                height: "8",
                border: "2px solid",
                borderColor: "gray.300",
                borderTopColor: "primary.500",
                borderRadius: "full",
                animation: "spin 1s linear infinite",
              })}
            />
            <p className={css({ color: "gray.600" })}>
              認証情報を確認しています...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
