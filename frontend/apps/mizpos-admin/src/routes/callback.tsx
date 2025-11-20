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
    // Cognito Hosted UIからのリダイレクト後の処理
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

        // Amplifyが自動的に認証トークンを処理するのを待つ
        // Hub eventsをリッスンして認証完了を検出
        const hubListener = Hub.listen("auth", (data) => {
          if (data.payload.event === "signedIn") {
            navigate({ to: "/" });
          }
        });

        // 念のため、認証セッションを確認
        try {
          const session = await fetchAuthSession();
          if (session.tokens?.accessToken) {
            // 認証成功、ホームにリダイレクト
            setTimeout(() => {
              navigate({ to: "/" });
            }, 500);
          } else {
            // トークンがまだない場合は、Amplifyの処理を待つ
            setTimeout(async () => {
              const retrySession = await fetchAuthSession();
              if (retrySession.tokens?.accessToken) {
                navigate({ to: "/" });
              } else {
                setError("認証トークンの取得に失敗しました。");
              }
            }, 2000);
          }
        } catch (sessionError) {
          console.error("Session check error:", sessionError);
          // セッションエラーの場合も少し待ってからリトライ
          setTimeout(() => {
            navigate({ to: "/" });
          }, 1500);
        }

        return () => {
          hubListener();
        };
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
