import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";

export const Route = createFileRoute("/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cognito Hosted UIからのリダイレクト後の処理
    // Amplifyが自動的に認証トークンを処理します
    const handleCallback = async () => {
      try {
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

        // 認証が成功した場合、ホームページにリダイレクト
        // Amplifyが自動的にトークンを処理するため、少し待機してからリダイレクト
        setTimeout(() => {
          navigate({ to: "/" });
        }, 1000);
      } catch (err) {
        console.error("Callback処理エラー:", err);
        setError("認証処理中にエラーが発生しました。");
      }
    };

    handleCallback();
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
