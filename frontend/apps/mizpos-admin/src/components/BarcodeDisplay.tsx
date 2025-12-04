import JsBarcode from "jsbarcode";
import { useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { Button } from "./Button";

interface BarcodeDisplayProps {
  value: string;
  label?: string;
  width?: number;
  height?: number;
}

/**
 * JANバーコード（EAN-13）を表示するコンポーネント
 */
export function BarcodeDisplay({
  value,
  label,
  width = 2,
  height = 60,
}: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // 数字のみを抽出（ハイフンなど除去）
        const cleanValue = value.replace(/\D/g, "");

        // 13桁のEAN-13形式を生成
        JsBarcode(svgRef.current, cleanValue, {
          format: "EAN13",
          width,
          height,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
        setError(null);
      } catch (e) {
        console.error("Barcode generation error:", e);
        setError("バーコード生成に失敗しました");
      }
    }
  }, [value, width, height]);

  if (error) {
    return (
      <div
        className={css({
          padding: "3",
          backgroundColor: "red.50",
          borderRadius: "md",
          color: "red.600",
          fontSize: "sm",
          textAlign: "center",
        })}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2",
      })}
    >
      {label && (
        <span
          className={css({
            fontSize: "sm",
            fontWeight: "medium",
            color: "gray.700",
          })}
        >
          {label}
        </span>
      )}
      <div
        className={css({
          backgroundColor: "white",
          padding: "2",
          borderRadius: "md",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <svg ref={svgRef} />
      </div>
    </div>
  );
}

interface TwoTierBarcodeProps {
  barcode1: string;
  barcode2: string;
  isdn?: string | null;
  isdnFormatted?: string | null;
  productName: string;
  onDownload?: () => void;
}

/**
 * 書籍JANコード（2段バーコード）を表示するコンポーネント
 */
export function TwoTierBarcode({
  barcode1,
  barcode2,
  isdn,
  isdnFormatted,
  productName,
  onDownload,
}: TwoTierBarcodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!containerRef.current) return;

    // SVGをPNGに変換してダウンロード
    const svgElements = containerRef.current.querySelectorAll("svg");
    if (svgElements.length < 2) return;

    // キャンバスを作成
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // SVGのサイズを取得
    const svg1 = svgElements[0];
    const svg2 = svgElements[1];
    const width = Math.max(svg1.clientWidth, svg2.clientWidth);
    const height = svg1.clientHeight + svg2.clientHeight + 60; // ヘッダー用のスペース

    canvas.width = width + 40;
    canvas.height = height + 40;

    // 背景を白に
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトルを描画
    ctx.fillStyle = "#000000";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(productName, canvas.width / 2, 25);

    // ISDNを描画
    if (isdnFormatted) {
      ctx.font = "12px monospace";
      ctx.fillText(isdnFormatted, canvas.width / 2, 45);
    }

    // SVGを画像に変換して描画
    const loadSvgAsImage = (svg: SVGSVGElement): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
      });
    };

    Promise.all([loadSvgAsImage(svg1), loadSvgAsImage(svg2)])
      .then(([img1, img2]) => {
        const startY = 55;
        ctx.drawImage(img1, (canvas.width - img1.width) / 2, startY);
        ctx.drawImage(
          img2,
          (canvas.width - img2.width) / 2,
          startY + img1.height + 5,
        );

        // ダウンロード
        const link = document.createElement("a");
        link.download = `barcode_${productName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch(console.error);

    onDownload?.();
  };

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "4",
        padding: "4",
        backgroundColor: "white",
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "gray.200",
      })}
    >
      <div
        className={css({
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "md",
          color: "gray.800",
        })}
      >
        {productName}
      </div>

      {isdnFormatted && (
        <div
          className={css({
            textAlign: "center",
            fontFamily: "mono",
            fontSize: "sm",
            color: "gray.600",
          })}
        >
          {isdnFormatted}
        </div>
      )}

      <div
        ref={containerRef}
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2",
          padding: "4",
          backgroundColor: "gray.50",
          borderRadius: "md",
        })}
      >
        <BarcodeDisplay value={barcode1} label="1段目（ISBN/ISDN）" />
        <BarcodeDisplay value={barcode2} label="2段目（分類・価格）" />
      </div>

      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          gap: "2",
        })}
      >
        <Button variant="secondary" size="sm" onClick={handleDownload}>
          PNG画像をダウンロード
        </Button>
      </div>

      <div
        className={css({
          fontSize: "xs",
          color: "gray.500",
          textAlign: "center",
        })}
      >
        <p>1段目: {barcode1}</p>
        <p>2段目: {barcode2}</p>
      </div>
    </div>
  );
}
