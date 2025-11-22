import { createFileRoute, Link } from "@tanstack/react-router";
import { css } from "styled-system/css";

export const Route = createFileRoute("/tos/scl")({
  component: SclPage,
});

function SclPage() {
  return (
    <div
      className={css({
        margin: "20px auto",
        maxWidth: "1200px",
        paddingX: "20px",
        lineHeight: "2",
      })}
    >
      <h1
        className={css({
          fontSize: "36px",
          fontWeight: "bold",
          marginBottom: "20px",
        })}
      >
        特定商取引法に基づく表記
      </h1>

      <section
        className={css({
          marginBottom: "30px",
        })}
      >
        <p>
          この文書は日本国の特定商取引に関する法律（昭和五十一年法律第五十七号）に基づく表示です。
        </p>
      </section>

      <section
        className={css({
          marginBottom: "30px",
        })}
      >
        <h2
          className={css({
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "10px",
          })}
        >
          この表示を実施する理由
        </h2>
        <p>
          日本国の特定商取引法においては、インターネット上での販売役務について法律上の規制が設けられています。
        </p>
        <p>
          インターネット上での役務提供は通信販売にあたりますから、法令に基づき以下の表記を実施します。
        </p>
      </section>

      <section
        className={css({
          marginBottom: "30px",
        })}
      >
        <h2
          className={css({
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "20px",
          })}
        >
          特定商取引法に基づく広告
        </h2>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            販売者名称
          </h3>
          <p>MIZPOS Operating Team（ミズポス）</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            運営統括責任者
          </h3>
          <p>尾川 史典</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            所在地
          </h3>
          <p>請求を頂ければ遅滞なく開示します。</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            電話番号
          </h3>
          <p>044-381-5442（通常時留守番電話です）</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            電話受付時間
          </h3>
          <p>
            通常留守番電話で運用しております。お返事は通常10:00~24:00に差し上げます。
          </p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            メールアドレス
          </h3>
          <p>
            <a
              href="mailto:mizphses+inquiry@gmail.com"
              className={css({
                color: "#3a585d",
                textDecoration: "underline",
                _hover: {
                  color: "#2a484d",
                },
              })}
            >
              mizphses+inquiry@gmail.com
            </a>
          </p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            サイトURL
          </h3>
          <p>
            <a
              href="https://sales.pos.miz.cab"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                color: "#3a585d",
                textDecoration: "underline",
                _hover: {
                  color: "#2a484d",
                },
              })}
            >
              https://sales.pos.miz.cab
            </a>{" "}
            およびpos.miz.cabのサブドメイン
            <br />
            （abc.pos.miz.cab、xxxxxx.yyyy.pos.miz.cabなど）
          </p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            商品の販売価格
          </h3>
          <p>各販売ページをご参照ください。</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            商品代金以外に必要な料金
          </h3>
          <p>
            <Link
              to="/delivery"
              className={css({
                color: "#3a585d",
                textDecoration: "underline",
                _hover: {
                  color: "#2a484d",
                },
              })}
            >
              配送案内
            </Link>
            ページをご参照ください。なお、このサイトでのご注文商品は、特記またはメール等でのお知らせのない限り、神奈川県川崎市から発送されます。
          </p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            支払方法
          </h3>
          <p>クレジットカード決済、銀行振込（日本国の三井住友銀行）</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            支払時期
          </h3>
          <p>商品注文時にお支払いが確定します。</p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            商品の引渡時期
          </h3>
          <p>
            物理的商品はご注文日から5営業日以内に発送いたします。通常、これに配送事業者等のリードタイム（詳細は配送事業者にご確認ください）が付加されます。
          </p>
          <p>
            デジタルデータ等の商品については注文確認後すぐにご利用いただけます。
          </p>
          <p>
            開発の受託、アドバイザリーについては別途契約書に定めのない場合、1ヶ月以内の初回実施を予定しています。
          </p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            返品・交換
          </h3>
          <p>商品到着後10日以内に限り返品・交換が可能です。</p>
          <p>
            キャンセルおよび返品交換の申請は、事前にサポートメール（
            <a
              href="mailto:mizphses+inquiry@gmail.com"
              className={css({
                color: "#3a585d",
                textDecoration: "underline",
                _hover: {
                  color: "#2a484d",
                },
              })}
            >
              mizphses+inquiry@gmail.com
            </a>
            ）までご連絡ください。
          </p>
        </div>

        <div
          className={css({
            borderLeft: "4px solid #3a585d",
            paddingLeft: "20px",
            marginBottom: "20px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "10px",
            })}
          >
            返品送料
          </h3>
          <p>
            商品に欠陥がある場合には当方負担、お客様のご都合による返品・交換の場合にはお客様負担となります。
          </p>
        </div>
      </section>
    </div>
  );
}
