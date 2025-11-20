import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { css } from "styled-system/css";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // ログアウト後の処理
    // Cognitoからのリダイレクト後、ログインページに遷移
    setTimeout(() => {
      navigate({ to: "/login" });
    }, 1000);
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
          ログアウト完了
        </h1>
        <p className={css({ color: "gray.600", marginBottom: "4" })}>
          ログアウトしました。ログインページに移動します...
        </p>
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
        </div>
      </div>
    </div>
  );
}
