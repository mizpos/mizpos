import {
  IconApple,
  IconBrandAndroid,
  IconBrandDebian,
  IconBrandWindows,
  IconDownload,
  IconExternalLink,
  IconInfoCircle,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Card, PageContainer } from "../components/ui";
import {
  CDN_URLS,
  DESKTOP_APP_VERSION,
  getEnvironment,
} from "../lib/constants";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
});

interface DownloadItem {
  platform: string;
  icon: React.ReactNode;
  description: string;
  files: {
    name: string;
    filename: string;
    size?: string;
    recommended?: boolean;
  }[];
  instructions: string[];
}

function DownloadPage() {
  const env = getEnvironment();
  const cdnUrl = import.meta.env.VITE_CDN_DOMAIN;
  const version = DESKTOP_APP_VERSION;

  const downloads: DownloadItem[] = [
    {
      platform: "Windows",
      icon: <IconBrandWindows size={32} />,
      description: "Windows 10/11 (64-bit)",
      files: [
        {
          name: "インストーラー (MSI)",
          filename: "mizpos-latest.msi",
          recommended: true,
        },
      ],
      instructions: [
        "MSIファイルをダウンロードして実行",
        "インストーラーの指示に従ってインストール",
        "スタートメニューから「mizpos」を起動",
      ],
    },
    {
      platform: "Linux",
      icon: <IconBrandDebian size={32} />,
      description: "Ubuntu / Debian / Fedora など",
      files: [
        {
          name: "AppImage (全ディストリ対応)",
          filename: "mizpos-latest.AppImage",
          recommended: true,
        },
        {
          name: "Debian パッケージ (.deb)",
          filename: "mizpos-latest.deb",
        },
      ],
      instructions: [
        "AppImage: ダウンロード後、chmod +x で実行権限を付与して起動",
        "DEB: sudo dpkg -i でインストール",
        "依存関係が不足している場合は sudo apt --fix-broken install",
      ],
    },
    {
      platform: "Android",
      icon: <IconBrandAndroid size={32} />,
      description: "Android 8.0 以上",
      files: [
        {
          name: "APK ファイル",
          filename: "mizpos-latest.apk",
          recommended: true,
        },
      ],
      instructions: [
        "設定で「提供元不明のアプリ」のインストールを許可",
        "APKファイルをダウンロードしてタップ",
        "インストール後、アプリを起動",
      ],
    },
  ];

  const getDownloadUrl = (filename: string, platform: string): string => {
    const osPath =
      platform === "Android"
        ? "android"
        : platform.toLowerCase() === "windows"
        ? "windows"
        : "linux";
    const envPath = env;

    if (platform === "Android") {
      return `${cdnUrl}/${osPath}/${envPath}/${filename}`;
    }
    return `${cdnUrl}/desktop/${envPath}/${osPath}/${filename}`;
  };

  return (
    <PageContainer title="クライアントダウンロード">
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "6",
          maxWidth: "1200px",
        })}
      >
        {/* Header info */}
        <Card>
          <div
            className={css({
              display: "flex",
              alignItems: "flex-start",
              gap: "4",
            })}
          >
            <div
              className={css({
                padding: "3",
                borderRadius: "lg",
                backgroundColor: "primary.50",
                color: "primary.600",
              })}
            >
              <IconInfoCircle size={24} />
            </div>
            <div>
              <h2
                className={css({
                  fontSize: "lg",
                  fontWeight: "semibold",
                  color: "gray.900",
                  marginBottom: "2",
                })}
              >
                mizpos デスクトップクライアント
              </h2>
              <p
                className={css({
                  fontSize: "sm",
                  color: "gray.600",
                  marginBottom: "2",
                })}
              >
                POSレジ端末用のデスクトップアプリケーションです。
                バーコードスキャン、オフライン対応などの機能があります。
              </p>
              <div
                className={css({
                  display: "flex",
                  gap: "4",
                  fontSize: "sm",
                })}
              >
                <span className={css({ color: "gray.500" })}>
                  バージョン:{" "}
                  <span
                    className={css({ fontWeight: "medium", color: "gray.700" })}
                  >
                    {version}
                  </span>
                </span>
                <span className={css({ color: "gray.500" })}>
                  環境:{" "}
                  <span
                    className={css({
                      fontWeight: "medium",
                      color: env === "prod" ? "success" : "warning",
                    })}
                  >
                    {env === "prod" ? "本番" : "開発"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Download cards */}
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: {
              base: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
            gap: "6",
          })}
        >
          {downloads.map((item) => (
            <Card key={item.platform} padding="lg">
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "3",
                  marginBottom: "4",
                })}
              >
                <div
                  className={css({
                    padding: "3",
                    borderRadius: "lg",
                    backgroundColor: "gray.100",
                    color: "gray.700",
                  })}
                >
                  {item.icon}
                </div>
                <div>
                  <h3
                    className={css({
                      fontSize: "lg",
                      fontWeight: "semibold",
                      color: "gray.900",
                    })}
                  >
                    {item.platform}
                  </h3>
                  <p className={css({ fontSize: "sm", color: "gray.500" })}>
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Download buttons */}
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "2",
                  marginBottom: "4",
                })}
              >
                {item.files.map((file) => (
                  <a
                    key={file.filename}
                    href={getDownloadUrl(file.filename, item.platform)}
                    download
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "3",
                      borderRadius: "lg",
                      backgroundColor: file.recommended
                        ? "primary.50"
                        : "gray.50",
                      border: "1px solid",
                      borderColor: file.recommended
                        ? "primary.200"
                        : "gray.200",
                      color: file.recommended ? "primary.700" : "gray.700",
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                      _hover: {
                        backgroundColor: file.recommended
                          ? "primary.100"
                          : "gray.100",
                        transform: "translateY(-1px)",
                      },
                    })}
                  >
                    <div>
                      <span
                        className={css({
                          fontSize: "sm",
                          fontWeight: "medium",
                          display: "block",
                        })}
                      >
                        {file.name}
                      </span>
                      {file.recommended && (
                        <span
                          className={css({
                            fontSize: "xs",
                            color: "primary.600",
                          })}
                        >
                          推奨
                        </span>
                      )}
                    </div>
                    <IconDownload size={18} />
                  </a>
                ))}
              </div>

              {/* Instructions */}
              <details
                className={css({
                  fontSize: "sm",
                })}
              >
                <summary
                  className={css({
                    cursor: "pointer",
                    color: "gray.600",
                    fontWeight: "medium",
                    marginBottom: "2",
                  })}
                >
                  インストール手順
                </summary>
                <ol
                  className={css({
                    paddingLeft: "5",
                    color: "gray.600",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1",
                  })}
                >
                  {item.instructions.map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ol>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
