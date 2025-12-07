# レジ金チェック・商品券決済機能 実装計画

## 概要

閉局時のレジ金チェック機能と、商品券での決済機能を追加する。

## 要件整理

### 1. 閉局時のレジ金チェック機能
- **金種別個数入力**: 10000, 5000, 2000, 1000, 500, 100, 50, 10, 1円
- **商品券等の入力** (key-value形式):
  - 百貨店商品券
  - イベント主催者発行商品券
  - 外貨（日本円建てで計算）
- **閉局導線**: 設定画面から開く
- **閉局完了後**: 端末登録をrevoke（無効化）

### 2. 決済手段の拡張
- **商品券種別**:
  - 百貨店商品券（おつり設定可能）
  - イベント主催者発行商品券（おつり設定可能）
- **一部商品券**: 現金と商品券の併用を許可
- **おつり設定**: 商品券の種別ごとに「おつりあり/なし」を設定可能

---

## 実装ステップ

### Step 1: 型定義の拡張 (`types/index.ts`)

```typescript
// 決済手段を拡張
export type PaymentMethod =
  | "cash"
  | "oya_cashless"
  | "voucher_department"      // 百貨店商品券
  | "voucher_event";          // イベント主催者発行商品券

// 商品券設定（おつりの有無など）
export interface VoucherConfig {
  type: "voucher_department" | "voucher_event";
  name: string;
  allowChange: boolean; // おつりを出すかどうか
}

// 金種カウント
export interface DenominationCount {
  denomination: number; // 金種（10000, 5000, ...）
  count: number;        // 個数
}

// 商品券等カウント
export interface VoucherCount {
  type: string;  // "百貨店商品券", "イベント主催者発行商品券", "外貨" など
  amount: number; // 日本円換算金額
  memo?: string;  // 備考（外貨の場合は通貨名など）
}

// 閉局レポート
export interface ClosingReport {
  id: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  eventId?: string;

  // 金種別カウント
  denominations: DenominationCount[];
  cashTotal: number;

  // 商品券等
  vouchers: VoucherCount[];
  voucherTotal: number;

  // 合計
  grandTotal: number;

  // 売上との差異
  expectedTotal: number;
  difference: number;

  closedAt: Date;
}
```

### Step 2: 設定に商品券設定を追加 (`types/index.ts`, `stores/settings.ts`)

```typescript
// AppSettings に追加
export interface AppSettings {
  // ... 既存のフィールド
  voucherConfigs?: VoucherConfig[];
}

// デフォルト商品券設定
const defaultVoucherConfigs: VoucherConfig[] = [
  { type: "voucher_department", name: "百貨店商品券", allowChange: true },
  { type: "voucher_event", name: "イベント主催者発行商品券", allowChange: false },
];
```

### Step 3: CheckoutModal の改修

1. **決済手段選択UI**: 現金、大家キャッシュレス、商品券（種別選択）
2. **複数決済手段の併用**: `payments[]` 配列に複数の決済を追加
3. **商品券決済フロー**:
   - 商品券金額入力
   - おつり計算（設定に応じて）
   - 不足分は現金で支払い

### Step 4: 閉局画面の新規作成 (`routes/closing.tsx`)

1. **金種カウント入力**:
   - 各金種の個数入力フィールド
   - 自動合計計算

2. **商品券等入力**:
   - 種別と金額のkey-value入力
   - 動的に行を追加/削除

3. **差異計算**:
   - 当日売上合計を取得
   - レジ金合計との差異を表示

4. **閉局処理**:
   - 閉局レポートをサーバーに送信
   - 端末登録をrevoke
   - ログアウト

### Step 5: 設定画面に閉局ボタン追加 (`routes/settings.tsx`)

- 「閉局」ボタンを追加
- クリックで閉局画面へ遷移

### Step 6: 端末revoke処理 (`stores/terminal.ts`)

```typescript
revokeTerminal: async () => {
  // サーバーに端末無効化リクエスト
  // ローカルのKeychainをクリア
  // セッションをクリア
}
```

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `types/index.ts` | PaymentMethod拡張、VoucherConfig、ClosingReport型追加 |
| `stores/settings.ts` | 商品券設定の追加 |
| `stores/terminal.ts` | revokeTerminal関数追加 |
| `components/CheckoutModal.tsx` | 商品券決済UI、複数決済手段対応 |
| `routes/closing.tsx` | **新規作成** - 閉局画面 |
| `routes/settings.tsx` | 閉局ボタン追加 |
| `lib/db.ts` | 閉局レポート保存、当日売上集計 |

---

## UI設計概要

### 決済画面（CheckoutModal改修）

```
┌─────────────────────────────────────┐
│ 支払い方法                          │
│ [現金] [キャッシュレス] [商品券▼]   │
├─────────────────────────────────────┤
│ 商品券種別: [百貨店商品券 ▼]        │
│ 商品券金額: [      1000] 円         │
│                                     │
│ ─── 支払い内訳 ───                  │
│ 商品券: ¥1,000                      │
│ 現金:   ¥500                        │
│ ─────────────────                   │
│ 合計:   ¥1,500                      │
│                                     │
│ お預かり: [      2000] 円           │
│ おつり:   ¥500                      │
└─────────────────────────────────────┘
```

### 閉局画面

```
┌─────────────────────────────────────┐
│ ← 戻る          閉局処理            │
├─────────────────────────────────────┤
│ ■ 現金                              │
│ ┌────────┬────────┬─────────┐       │
│ │ 金種   │ 枚数   │ 小計    │       │
│ ├────────┼────────┼─────────┤       │
│ │ ¥10000 │ [  2] │ ¥20,000 │       │
│ │ ¥5000  │ [  1] │ ¥5,000  │       │
│ │ ¥1000  │ [  5] │ ¥5,000  │       │
│ │ ...    │       │         │       │
│ └────────┴────────┴─────────┘       │
│ 現金合計: ¥30,000                   │
├─────────────────────────────────────┤
│ ■ 商品券等                          │
│ [百貨店商品券    ▼] [     1000] 円  │
│ [イベント商品券  ▼] [     2000] 円  │
│ [外貨           ▼] [      500] 円  │
│                          [+ 追加]  │
│ 商品券等合計: ¥3,500                │
├─────────────────────────────────────┤
│ ■ 集計                              │
│ レジ金合計:     ¥33,500             │
│ 売上合計:       ¥33,000             │
│ 差異:           +¥500               │
├─────────────────────────────────────┤
│        [閉局を確定する]             │
│ ※閉局後、端末登録は無効化されます  │
└─────────────────────────────────────┘
```

---

## 実装順序

1. **型定義の拡張** - 基盤となる型を先に定義
2. **設定に商品券設定追加** - 商品券のおつり設定を管理
3. **CheckoutModal改修** - 商品券決済と複数決済対応
4. **閉局画面新規作成** - 金種カウント・閉局処理
5. **設定画面に閉局ボタン追加**
6. **端末revoke処理追加**
7. **テスト・動作確認**
