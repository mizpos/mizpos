import { createFileRoute } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/delivery/")({
  component: App,
});

// 17trackのグローバル型定義
declare global {
  interface Window {
    YQV5?: {
      trackSingle: (config: {
        YQ_ContainerId: string;
        YQ_Height?: number;
        YQ_Fc?: string;
        YQ_Lang?: string;
        YQ_Num: string;
      }) => void;
    };
  }
}

function App() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [carrier, setCarrier] = useState("0"); // 配送業者コード

  useEffect(() => {
    // 17trackのスクリプトを動的に読み込む
    const script = document.createElement("script");
    script.src = "//www.17track.net/externalcall.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
    };

    document.body.appendChild(script);

    // クリーンアップ
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleTrack = () => {
    if (!trackingNumber.trim()) {
      alert("追跡番号を入力してください。");
      return;
    }

    if (!scriptLoaded || !window.YQV5) {
      alert(
        "トラッキングシステムの読み込み中です。しばらく待ってから再度お試しください。"
      );
      return;
    }

    window.YQV5.trackSingle({
      // 必須: コンテンツホストのコンテナIDを指定
      YQ_ContainerId: "YQContainer",
      // 任意: 追跡結果の高さを指定（最大800px、デフォルト560px）
      YQ_Height: 560,
      // 任意: 配送業者を選択（0は自動認識、2003はヤマト、2005は佐川、2014は日本郵便）
      YQ_Fc: carrier,
      // 任意: UI言語を指定（jaは日本語）
      YQ_Lang: "ja",
      // 必須: 追跡番号
      YQ_Num: trackingNumber,
    });
  };

  return (
    <div
      className={css({
        margin: "20px auto",
        maxWidth: "1200px",
        paddingX: "20px",
        lineHeight: "2",
      })}
    >
      <h2
        className={css({
          fontSize: "36px",
          fontWeight: "bold",
        })}
      >
        配送のご案内
      </h2>
      <p>
        このサイトでのご注文商品は、特記またはメール等でのお知らせのない限り、神奈川県川崎市から発送されます。
      </p>
      <h3
        className={css({
          fontSize: "24px",
          fontWeight: "bold",
        })}
      >
        商品別配送のご案内
      </h3>
      <h4
        className={css({
          fontSize: "18px",
          fontWeight: "bold",
        })}
      >
        配送料（実物の配送がある場合。）
      </h4>
      <p>
        日本国内への発送については、
        <a
          href="https://www.post.japanpost.jp/send/fee/kokunai/pdf/kanto.pdf"
          target="_blank"
        >
          日本郵便
        </a>
        、
        <a
          href="https://www.sagawa-exp.co.jp/send/fare/faretable04.html"
          target="_blank"
        >
          佐川運輸
        </a>
        または
        <a
          href="https://www.kuronekoyamato.co.jp/ytc/search/estimate/ichiran.html"
          target="_blank"
        >
          ヤマト運輸
        </a>
        の神奈川県発運賃に準じます。
      </p>
      <p>以下に該当する場合、配送料を免除いたします。</p>
      <ul
        className={css({
          listStyle: "disc",
          paddingLeft: "20px",
        })}
      >
        <li>神奈川県川崎市幸区・川崎区へのご配送</li>
        <li>
          1,000円以上ご注文、且つ、こねこ便（クロネコヤマト）またはレターパックライト（日本郵便）での発送が可能な商品
        </li>
      </ul>
      <h5
        className={css({
          fontSize: "16px",
          fontWeight: "bold",
        })}
      >
        国外向け配送
      </h5>
      <p>
        注）日本国内の越境事業者をご利用の場合は国内配送の規定に準じます。ただし、配送に関する当社の責任は越境事業者への納品までといたします。
      </p>
      <p>
        海外向けに当社から発送する場合、日本郵便のEMSまたはUGXにより配送します。詳細は
        <a
          href="https://www.post.japanpost.jp/int/UGX/index.html"
          target="_blank"
        >
          こちら
        </a>
        をご覧ください。なお、関税はご負担ください。
      </p>
      <h4
        className={css({
          fontSize: "18px",
          fontWeight: "bold",
        })}
      >
        引渡時期
      </h4>
      <p>
        実体のある商品はご注文日から5営業日以内に発送いたします。通常、これに配送事業者等のリードタイム（詳細は配送事業者にご確認ください）が付加されます。
      </p>
      <p>
        デジタルデータ等の商品については注文確認後、通常5分以内にご利用いただけます。
      </p>
      <p>
        ただし、上記の規定に拘らず予約注文などの形式で引渡時期を別途定める商品については、商品ページに記載のある引渡時期に従います。
      </p>

      {/* 配送追跡セクション */}
      <h3
        className={css({
          fontSize: "24px",
          fontWeight: "bold",
          marginTop: "40px",
        })}
      >
        配送状況の追跡
      </h3>
      <p>お荷物の追跡番号を入力して、配送状況を確認できます。</p>
      <div
        className={css({
          marginTop: "20px",
          marginBottom: "20px",
        })}
      >
        <div
          className={css({
            display: "flex",
            gap: "10px",
            alignItems: "center",
            marginBottom: "20px",
          })}
        >
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className={css({
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "5px",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "white",
              cursor: "pointer",
              _focus: {
                borderColor: "#3a585d",
              },
            })}
          >
            <option value="0">自動認識</option>
            <option value="100062">ヤマト運輸</option>
            <option value="100040">佐川急便</option>
            <option value="10021">日本郵便</option>
          </select>
          <input
            type="text"
            id="YQNum"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            maxLength={50}
            placeholder="追跡番号を入力してください"
            className={css({
              flex: "1",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "5px",
              fontSize: "14px",
              outline: "none",
              _focus: {
                borderColor: "#3a585d",
              },
            })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleTrack();
              }
            }}
          />
          <button
            onClick={handleTrack}
            className={css({
              padding: "10px 20px",
              backgroundColor: "#3a585d",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              _hover: {
                backgroundColor: "#2a484d",
              },
              _disabled: {
                backgroundColor: "#ccc",
                cursor: "not-allowed",
              },
            })}
            disabled={!scriptLoaded}
          >
            追跡
          </button>
        </div>
        {/* 追跡結果表示用のコンテナ */}
        <div
          id="YQContainer"
          className={css({
            minHeight: "100px",
            border: "1px solid #e0e0e0",
            borderRadius: "5px",
            padding: "10px",
          })}
        />
      </div>
    </div>
  );
}
