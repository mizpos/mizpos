import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { css } from "styled-system/css";
import { getAuthHeaders } from "../lib/api";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "../lib/constants";

const API_GATEWAY_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  uploadType?: "book_cover" | "publisher_logo" | "other";
  label?: string;
  required?: boolean;
}

export function ImageUploadField({
  value,
  onChange,
  uploadType = "book_cover",
  label = "画像",
  required = false,
}: ImageUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return "画像ファイル (JPEG, PNG, GIF, WebP, SVG) のみアップロード可能です";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `ファイルサイズは${MAX_FILE_SIZE_MB}MB以下にしてください`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Presigned URL取得
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/stock/uploads`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          upload_type: uploadType,
        }),
      });

      if (!response.ok) {
        throw new Error("Presigned URLの取得に失敗しました");
      }

      const data = await response.json();
      const { upload_url, cdn_url } = data;

      // Step 2: S3へ直接アップロード
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("ファイルのアップロードに失敗しました");
      }

      setUploadProgress(100);
      onChange(cdn_url);
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error ? err.message : "アップロードに失敗しました",
      );
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    await uploadFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    await uploadFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
  };

  const labelClass = css({
    display: "block",
    fontSize: "sm",
    fontWeight: "medium",
    color: "gray.700",
    marginBottom: "1",
  });

  return (
    <div>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: ちょっと実装上厳しいので */}
      <label className={labelClass}>
        {label} {required && "*"}
      </label>
      {value && !isUploading ? (
        <div
          className={css({
            position: "relative",
            borderRadius: "md",
            border: "1px solid",
            borderColor: "gray.300",
            overflow: "hidden",
          })}
        >
          <img
            src={value}
            alt="プレビュー"
            className={css({
              width: "100%",
              maxHeight: "64",
              objectFit: "contain",
              backgroundColor: "gray.50",
            })}
          />
          <button
            type="button"
            onClick={handleRemove}
            className={css({
              position: "absolute",
              top: "2",
              right: "2",
              padding: "1",
              backgroundColor: "red.500",
              color: "white",
              borderRadius: "md",
              cursor: "pointer",
              _hover: {
                backgroundColor: "red.600",
              },
            })}
          >
            <IconX size={16} />
          </button>
        </div>
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: ちょっと実装上厳しいので
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={css({
            position: "relative",
            padding: "6",
            borderRadius: "md",
            border: "2px dashed",
            borderColor: isDragging ? "primary.500" : "gray.300",
            backgroundColor: isDragging ? "primary.50" : "gray.50",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            _hover: {
              borderColor: "primary.400",
              backgroundColor: "primary.50",
            },
          })}
        >
          <input
            type="file"
            accept={allowedTypes.join(",")}
            onChange={handleFileSelect}
            disabled={isUploading}
            className={css({
              position: "absolute",
              inset: "0",
              width: "100%",
              height: "100%",
              opacity: "0",
              cursor: "pointer",
            })}
          />

          {isUploading ? (
            <div>
              <div
                className={css({
                  marginBottom: "2",
                  fontSize: "sm",
                  color: "gray.600",
                })}
              >
                アップロード中... {uploadProgress}%
              </div>
              <div
                className={css({
                  width: "100%",
                  height: "2",
                  backgroundColor: "gray.200",
                  borderRadius: "full",
                  overflow: "hidden",
                })}
              >
                <div
                  className={css({
                    height: "100%",
                    backgroundColor: "primary.500",
                    transition: "width 0.3s",
                  })}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "2",
                })}
              >
                {isDragging ? (
                  <IconUpload
                    size={32}
                    className={css({ color: "primary.500" })}
                  />
                ) : (
                  <IconPhoto size={32} className={css({ color: "gray.400" })} />
                )}
              </div>
              <p className={css({ fontSize: "sm", color: "gray.600" })}>
                クリックして画像を選択、またはドラッグ&ドロップ
              </p>
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                JPEG, PNG, GIF, WebP, SVG (最大{MAX_FILE_SIZE_MB}MB)
              </p>
            </>
          )}
        </div>
      )}
      {error && (
        <p
          className={css({
            marginTop: "1",
            fontSize: "sm",
            color: "red.600",
          })}
        >
          {error}
        </p>
      )}
    </div>
  );
}
