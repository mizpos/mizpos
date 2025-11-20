import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../../contexts/AuthContext";
import { getUserInfo, updateUserInfo } from "../../lib/api";

export const Route = createFileRoute("/setup-profile/")({
  component: SetupProfilePage,
});

function SetupProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  // ユーザー情報を取得
  const { data: userInfo, isLoading } = useQuery({
    queryKey: ["userInfo", user?.sub],
    queryFn: () => {
      if (!user?.sub) throw new Error("User not found");
      return getUserInfo(user.sub);
    },
    enabled: !!user?.sub,
  });

  // ディスプレイネーム設定mutation
  const setupProfileMutation = useMutation({
    mutationFn: async (newDisplayName: string) => {
      if (!user?.sub) throw new Error("User not found");
      return await updateUserInfo(user.sub, { display_name: newDisplayName });
    },
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (error: Error) => {
      console.error("Display name setup error:", error);
      setError("ディスプレイネームの設定に失敗しました");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("ディスプレイネームを入力してください");
      return;
    }

    if (displayName.length > 100) {
      setError("ディスプレイネームは100文字以内にしてください");
      return;
    }

    setupProfileMutation.mutate(displayName);
  };

  // すでにディスプレイネームが設定されている場合はホームにリダイレクト
  if (!isLoading && userInfo?.display_name) {
    window.location.href = "/";
    return null;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={css({
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        })}
      >
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div
      className={css({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        padding: "20px",
      })}
    >
      <div
        className={css({
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "500px",
        })}
      >
        <h1
          className={css({
            fontSize: "28px",
            fontWeight: "bold",
            marginBottom: "16px",
            textAlign: "center",
          })}
        >
          プロフィール設定
        </h1>
        <p
          className={css({
            fontSize: "14px",
            color: "#666",
            marginBottom: "32px",
            textAlign: "center",
          })}
        >
          はじめに、ディスプレイネームを設定してください
        </p>

        <form onSubmit={handleSubmit}>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            })}
          >
            {error && (
              <div
                className={css({
                  padding: "12px",
                  backgroundColor: "#f8d7da",
                  border: "1px solid #f5c2c7",
                  borderRadius: "4px",
                  color: "#842029",
                  fontSize: "14px",
                })}
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="displayName"
                className={css({
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                })}
              >
                ディスプレイネーム
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例: 山田太郎"
                required
                maxLength={100}
                className={css({
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "16px",
                  _focus: {
                    outline: "none",
                    borderColor: "#f0c14b",
                    boxShadow: "0 0 0 3px rgba(240, 193, 75, 0.2)",
                  },
                })}
              />
              <p
                className={css({
                  fontSize: "12px",
                  color: "#666",
                  marginTop: "4px",
                })}
              >
                100文字以内で入力してください
              </p>
            </div>

            <button
              type="submit"
              disabled={setupProfileMutation.isPending}
              className={css({
                width: "100%",
                padding: "14px",
                backgroundColor: "#f0c14b",
                border: "1px solid #a88734",
                borderRadius: "3px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: setupProfileMutation.isPending
                  ? "not-allowed"
                  : "pointer",
                opacity: setupProfileMutation.isPending ? 0.6 : 1,
                _hover: {
                  backgroundColor: setupProfileMutation.isPending
                    ? "#f0c14b"
                    : "#ddb347",
                },
              })}
            >
              {setupProfileMutation.isPending ? "設定中..." : "設定を完了する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
