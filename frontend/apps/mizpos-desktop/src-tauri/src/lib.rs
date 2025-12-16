// Desktop-only modules
#[cfg(not(target_os = "android"))]
mod jp_escpos;

// 端末認証モジュール
mod terminal_auth;

// Desktop USB printer implementation
#[cfg(not(target_os = "android"))]
mod desktop_printer {
    use escpos::driver::NativeUsbDriver;
    use crate::jp_escpos::{JpPrinter, PaperWidth, TextStyle};
    use serde::Deserialize;

    #[derive(Debug, Clone, serde::Serialize)]
    pub struct DeviceInfo {
        pub vendor_id: u16,
        pub device_id: u16,
        pub name: String,
    }

    /// 商品明細
    #[derive(Debug, Clone, Deserialize)]
    pub struct ReceiptItem {
        /// 出版サークル名
        pub circle_name: String,
        /// 商品名
        pub name: String,
        /// JAN
        pub jan: String,
        /// ISBN
        pub isbn: String,
        /// ISDN（書籍の場合）
        pub isdn: Option<String>,
        /// 2段目バーコード（Cコード＋値段、書籍の場合）
        pub jan2: Option<String>,
        /// 書籍フラグ
        pub is_book: bool,
        /// 商品数
        pub quantity: u32,
        /// 値段（単価 x 数量）
        pub price: u32,
    }

    /// 支払情報
    #[derive(Debug, Clone, Deserialize)]
    pub struct PaymentInfo {
        /// 支払手段名（現金、クレジットカードなど）
        pub method: String,
        /// 支払金額
        pub amount: u32,
    }

    /// カード詳細情報（クレジット売上票用）
    #[derive(Debug, Clone, Deserialize)]
    pub struct CardDetails {
        /// カードブランド（visa, mastercard等）
        pub brand: Option<String>,
        /// カード番号下4桁
        pub last4: Option<String>,
        /// 有効期限（月）
        pub exp_month: Option<u32>,
        /// 有効期限（年）
        pub exp_year: Option<u32>,
        /// カード名義人
        pub cardholder_name: Option<String>,
        /// カード種別（credit, debit等）
        pub funding: Option<String>,
        /// 端末シリアル番号
        pub terminal_serial_number: Option<String>,
        /// 加盟店名（Stripeアカウント名）
        pub merchant_name: Option<String>,
        /// 取引種別（sale/refund）
        pub transaction_type: Option<String>,
        /// 支払区分
        pub payment_type: Option<String>,
        /// 取引日時（ISO8601形式）
        pub transaction_at: Option<String>,
    }

    /// レシートデータ
    #[derive(Debug, Clone, Deserialize)]
    pub struct ReceiptData {
        /// イベント名称
        pub event_name: String,
        /// サークル名（トップに大きく表示）
        pub circle_name: Option<String>,
        /// 会場住所
        pub venue_address: Option<String>,
        /// 発売日時
        pub sale_start_date_time: Option<String>,
        /// スタッフ番号
        pub staff_id: String,
        /// 宛名（様の前に表示、未使用）
        pub customer_name: Option<String>,
        /// 商品明細リスト
        pub items: Vec<ReceiptItem>,
        /// 合計金額
        pub total: u32,
        /// 支払情報リスト
        pub payments: Vec<PaymentInfo>,
        /// 消費税率（%）
        pub tax_rate: u32,
        /// 消費税金額
        pub tax_amount: u32,
        /// レシート番号
        pub receipt_number: String,
        /// カード詳細情報（クレジット決済時）
        pub card_details: Option<CardDetails>,
        /// Stripe PaymentIntent ID（クレジット決済時）
        pub payment_intent_id: Option<String>,
    }

    #[tauri::command]
    pub fn get_usb_devices() -> Result<Vec<DeviceInfo>, String> {
        use nusb::MaybeFuture;

        let device_list = nusb::list_devices()
            .wait()
            .map_err(|e| e.to_string())?;

        let devices: Vec<DeviceInfo> = device_list
            .map(|device_info| {
                let vendor_id = device_info.vendor_id();
                let product_id = device_info.product_id();
                let name = device_info
                    .product_string()
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                DeviceInfo {
                    vendor_id,
                    device_id: product_id,
                    name,
                }
            })
            .collect();

        Ok(devices)
    }

    fn parse_paper_width(paper_width: Option<u8>) -> PaperWidth {
        match paper_width {
            Some(80) => PaperWidth::Mm80,
            _ => PaperWidth::Mm58,
        }
    }

    #[tauri::command]
    pub fn welcome_print(
        vendor_id: u16,
        device_id: u16,
        id: String,
        paper_width: Option<u8>,
    ) -> Result<(), String> {
        let driver = NativeUsbDriver::open(vendor_id, device_id)
            .map_err(|e| e.to_string())?;

        let width = parse_paper_width(paper_width);
        let mut printer = JpPrinter::with_paper_width(driver, width);
        printer.init()?;

        printer.jp_textln("WELCOME TO mizPOS", TextStyle::default().bold().underline().center())?;
        printer.textln("")?;
        printer.jp_textln("mizPOS デスクトップターミナル", TextStyle::default().center())?;
        printer.jp_textln("接続テスト完了", TextStyle::default().center())?;
        printer.textln("")?;
        printer.separator()?;
        printer.row_auto("ターミナルID:", &id)?;
        printer.separator()?;
        printer.textln("")?;
        printer.jp_textln("日本語印刷テスト", TextStyle::default().bold())?;
        printer.textln("ひらがな: あいうえお")?;
        printer.textln("カタカナ: アイウエオ")?;
        printer.textln("漢字: 東京都渋谷区")?;
        printer.textln("")?;
        printer.feed(3)?;
        printer.cut()?;

        Ok(())
    }

    #[tauri::command]
    pub fn text_print(
        vendor_id: u16,
        device_id: u16,
        text: String,
        paper_width: Option<u8>,
    ) -> Result<(), String> {
        let driver = NativeUsbDriver::open(vendor_id, device_id)
            .map_err(|e| e.to_string())?;

        let width = parse_paper_width(paper_width);
        let mut printer = JpPrinter::with_paper_width(driver, width);
        printer.init()?;
        printer.textln(&text)?;
        printer.feed(3)?;
        printer.cut()?;

        Ok(())
    }

    /// 数値を全角数字に変換
    fn to_fullwidth_number(num: u32) -> String {
        num.to_string()
            .chars()
            .map(|c| match c {
                '0' => '０',
                '1' => '１',
                '2' => '２',
                '3' => '３',
                '4' => '４',
                '5' => '５',
                '6' => '６',
                '7' => '７',
                '8' => '８',
                '9' => '９',
                _ => c,
            })
            .collect()
    }

    /// 金額をフォーマット（カンマ区切り + 円）
    /// 全角￥（U+FFE5）を使用（Shift-JISで半角¥と\は同じコードのため）
    fn format_price(price: u32) -> String {
        let s = price.to_string();
        let mut result = String::new();
        for (i, c) in s.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 {
                result.insert(0, ',');
            }
            result.insert(0, c);
        }
        format!("￥{}", result)
    }

    /// ISDN + jan2からCコード＋値段の表示文字列を生成
    fn format_book_number(isdn: &Option<String>, jan2: &Option<String>) -> Option<String> {
        let isdn_str = isdn.as_ref()?;
        let jan2_str = jan2.as_ref()?;

        if isdn_str.is_empty() || jan2_str.len() < 12 {
            return None;
        }

        // jan2からCコードを抽出（例: 1920094001600 → C0094）
        let c_code = format!("C{}", &jan2_str[3..7]);

        // jan2から値段を抽出
        let price_str = &jan2_str[8..12];
        let price_value: u32 = price_str.trim_start_matches('0').parse().unwrap_or(0);

        Some(format!("{} {} {}", isdn_str, c_code, format_price(price_value)))
    }

    /// レシート印刷
    #[tauri::command]
    pub fn print_receipt(
        vendor_id: u16,
        device_id: u16,
        receipt: ReceiptData,
        paper_width: Option<u8>,
    ) -> Result<(), String> {
        let driver = NativeUsbDriver::open(vendor_id, device_id)
            .map_err(|e| e.to_string())?;

        let width = parse_paper_width(paper_width);
        let mut printer = JpPrinter::with_paper_width(driver, width);
        printer.init()?;

        // サークル名（トップに大きく表示）
        if let Some(ref circle_name) = receipt.circle_name {
            if !circle_name.is_empty() {
                printer.jp_textln_padded(circle_name, TextStyle::default().double().center())?;
            }
        }

        // イベント名・会場住所（サークル名の下に表示）
        if let Some(ref venue_address) = receipt.venue_address {
            if !venue_address.is_empty() && !receipt.event_name.is_empty() {
                printer.jp_textln(&receipt.event_name, TextStyle::default().bold())?;
                printer.jp_textln(venue_address, TextStyle::default())?;
            }
        }

        // ご明細書（黒背景中央揃え文字２倍サイズ）
        printer.jp_textln_padded("ご明細書", TextStyle::default().double().reverse().center())?;

        // レシート番号
        printer.jp_textln(&format!("# {}", receipt.receipt_number), TextStyle::default())?;

        // 発売日時 責: {スタッフ番号}
        if let Some(ref sale_date_time) = receipt.sale_start_date_time {
            printer.jp_textln(&format!("{} 責: {}", sale_date_time, receipt.staff_id), TextStyle::default())?;
        } else {
            printer.jp_textln(&format!("責: {}", receipt.staff_id), TextStyle::default())?;
        }

        printer.separator()?;

        // 商品明細
        for item in &receipt.items {
            // 商品番号: 書籍の場合は「ISDN Cコード 値段」、それ以外はJAN
            let display_number = if item.is_book {
                format_book_number(&item.isdn, &item.jan2).unwrap_or_else(|| item.jan.clone())
            } else {
                item.jan.clone()
            };

            printer.jp_textln(&display_number, TextStyle::default().bold())?;
            printer.jp_textln(&format!("{} / {}", item.circle_name, item.name), TextStyle::default())?;

            // 単価を計算
            let unit_price = if item.quantity > 0 { item.price / item.quantity } else { item.price };
            // @ {単価} {点数}点 {小計} （右寄せ・太字）
            printer.jp_textln(
                &format!("@ {}　 {} 点　{}", format_price(unit_price), item.quantity, format_price(item.price)),
                TextStyle::default().right().bold()
            )?;
        }

        printer.separator()?;

        // 合計（税込）（太字・右寄せ）
        printer.row_auto_bold("合計(税込)", &format_price(receipt.total))?;

        // 内税表示（税率と税額）
        if receipt.tax_rate > 0 && receipt.tax_amount > 0 {
            printer.row_auto(
                &format!("(内 {}%税)", receipt.tax_rate),
                &format_price(receipt.tax_amount)
            )?;
        }

        // 支払情報
        for payment in &receipt.payments {
            printer.row_auto(&format!("　 {}", payment.method), &format_price(payment.amount))?;
        }

        // 釣り銭計算（現金支払いの場合）
        let cash_payment = receipt.payments.iter().find(|p| p.method == "現金");
        if let Some(cash) = cash_payment {
            let change = cash.amount.saturating_sub(receipt.total);
            if change > 0 {
                printer.row_auto("　 釣り銭", &format_price(change))?;
            }
        }

        printer.separator()?;

        // 免税事業者の説明文
        printer.jp_textln("当店は免税事業者であり、適格請求書を発行することはできません。返品・返金は落丁・乱丁の場合のみ受け付けます。返品・返金の場合は本明細書を添付しサポートセンター support-pos@miz.cabにご連絡ください。", TextStyle::default())?;

        printer.textln("")?;

        // QRコード（レシート番号）
        printer.qr_code_center(&receipt.receipt_number, Some(6))?;

        // クレジット売上票（カード詳細がある場合のみ）
        if let Some(ref card) = receipt.card_details {
            printer.textln("")?;
            printer.jp_textln_padded("クレジット売上票", TextStyle::default().reverse().center())?;
            printer.textln("")?;

            // 加盟店名（Stripeアカウント名を優先、なければサークル名を使用）
            let merchant_name = card.merchant_name.as_ref()
                .filter(|s| !s.is_empty())
                .or(receipt.circle_name.as_ref().filter(|s| !s.is_empty()));
            if let Some(name) = merchant_name {
                printer.row_auto("加盟店名:", name)?;
            }

            // 端末番号
            if let Some(ref terminal_sn) = card.terminal_serial_number {
                printer.row_auto("端末番号:", terminal_sn)?;
            }

            // ご利用日時
            if let Some(ref tx_at) = card.transaction_at {
                // ISO8601をフォーマット（例: 2025-12-16T10:30:00Z → 2025/12/16 10:30）
                let formatted = format_transaction_datetime(tx_at);
                printer.row_auto("ご利用日時:", &formatted)?;
            }

            // 伝票番号（PaymentIntent ID）
            if let Some(ref pi_id) = receipt.payment_intent_id {
                // IDが長い場合は末尾のみ表示
                let display_id = if pi_id.len() > 16 {
                    format!("...{}", &pi_id[pi_id.len()-12..])
                } else {
                    pi_id.clone()
                };
                printer.row_auto("伝票番号:", &display_id)?;
            }

            printer.separator()?;

            // 会員番号（マスク済みカード番号）
            if let Some(ref last4) = card.last4 {
                printer.row_auto("会員番号:", &format!("**** **** **** {}", last4))?;
            }

            // 取引内容
            let tx_type = card.transaction_type.as_deref().unwrap_or("sale");
            let tx_type_display = match tx_type {
                "sale" => "売上",
                "refund" => "返品",
                _ => tx_type,
            };
            printer.row_auto("取引内容:", tx_type_display)?;

            // 支払い区分
            let payment_type = card.payment_type.as_deref().unwrap_or("一括");
            printer.row_auto("支払区分:", payment_type)?;

            // カード会社
            if let Some(ref brand) = card.brand {
                let brand_display = match brand.to_lowercase().as_str() {
                    "visa" => "VISA",
                    "mastercard" | "mc" => "MasterCard",
                    "amex" | "american_express" => "AMEX",
                    "jcb" => "JCB",
                    "diners" | "diners_club" => "Diners Club",
                    "discover" => "Discover",
                    "unionpay" => "UnionPay",
                    _ => brand,
                };
                printer.row_auto("カード会社:", brand_display)?;
            }

            // 有効期限
            if let (Some(month), Some(year)) = (card.exp_month, card.exp_year) {
                let year_short = year % 100;
                printer.row_auto("有効期限:", &format!("{:02}/{:02}", month, year_short))?;
            }

            printer.separator()?;

            // 利用金額
            printer.row_auto_bold("ご利用金額:", &format_price(receipt.total))?;

            printer.textln("")?;

            // 署名欄
            printer.jp_textln("【お客様サイン】", TextStyle::default().bold())?;
            printer.textln("")?;
            printer.jp_textln_padded("＜IC取引につき不要＞", TextStyle::default().center())?;
            printer.textln("")?;
            printer.separator()?;

            printer.jp_textln("上記正に受領いたしました", TextStyle::default().center())?;

            // 決済番号QRコード（PaymentIntent ID）
            if let Some(ref pi_id) = receipt.payment_intent_id {
                printer.textln("")?;
                printer.qr_code_center(pi_id, Some(4))?;
            }
        }

        printer.feed(3)?;
        printer.cut()?;

        Ok(())
    }

    /// ISO8601形式の日時を読みやすい形式に変換
    fn format_transaction_datetime(iso_datetime: &str) -> String {
        // 簡易パース: 2025-12-16T10:30:00.000Z のような形式を想定
        if iso_datetime.len() >= 16 {
            let date_part = &iso_datetime[0..10];
            let time_part = &iso_datetime[11..16];
            let date_formatted = date_part.replace('-', "/");
            format!("{} {}", date_formatted, time_part)
        } else {
            iso_datetime.to_string()
        }
    }

    /// 金種カウント
    #[derive(Debug, Clone, Deserialize)]
    pub struct DenominationCount {
        pub denomination: u32,
        pub count: u32,
    }

    /// 商品券カウント
    #[derive(Debug, Clone, Deserialize)]
    pub struct VoucherCount {
        #[serde(rename = "type")]
        pub voucher_type: String,
        pub amount: u32,
        pub memo: Option<String>,
    }

    /// 閉局レポートデータ
    #[derive(Debug, Clone, Deserialize)]
    pub struct ClosingReportData {
        pub id: String,
        pub terminal_id: String,
        pub staff_id: String,
        pub staff_name: String,
        pub event_name: Option<String>,
        pub denominations: Vec<DenominationCount>,
        pub cash_total: u32,
        pub vouchers: Vec<VoucherCount>,
        pub voucher_total: u32,
        pub grand_total: u32,
        pub expected_total: u32,
        pub difference: i32,
        pub transaction_count: u32,
        pub closed_at: String,
    }

    /// 閉局レポート印刷
    #[tauri::command]
    pub fn print_closing_report(
        vendor_id: u16,
        device_id: u16,
        report: ClosingReportData,
        paper_width: Option<u8>,
    ) -> Result<(), String> {
        let driver = NativeUsbDriver::open(vendor_id, device_id)
            .map_err(|e| e.to_string())?;

        let width = parse_paper_width(paper_width);
        let mut printer = JpPrinter::with_paper_width(driver, width);
        printer.init()?;

        // ヘッダー
        printer.jp_textln_padded("閉局レポート", TextStyle::default().double().reverse().center())?;
        printer.textln("")?;

        // イベント名
        if let Some(ref event_name) = report.event_name {
            if !event_name.is_empty() {
                printer.jp_textln(event_name, TextStyle::default().bold().center())?;
            }
        }

        // 基本情報
        printer.separator()?;
        printer.row_auto("レポートID:", &report.id)?;
        printer.row_auto("端末ID:", &report.terminal_id)?;
        printer.row_auto("担当者:", &format!("{} ({})", report.staff_name, report.staff_id))?;
        printer.row_auto("閉局日時:", &report.closed_at)?;
        printer.separator()?;

        // 売上サマリー
        printer.jp_textln("【売上サマリー】", TextStyle::default().bold())?;
        printer.row_auto("取引件数:", &format!("{}件", report.transaction_count))?;
        printer.row_auto("売上合計(税込):", &format_price(report.expected_total))?;
        printer.separator()?;

        // 金種別カウント
        printer.jp_textln("【現金内訳】", TextStyle::default().bold())?;
        for d in &report.denominations {
            if d.count > 0 {
                let subtotal = d.denomination * d.count;
                printer.row_auto(
                    &format!("{}円 x {}", d.denomination, d.count),
                    &format_price(subtotal),
                )?;
            }
        }
        printer.row_auto_bold("現金合計:", &format_price(report.cash_total))?;
        printer.separator()?;

        // 商品券等
        if !report.vouchers.is_empty() {
            printer.jp_textln("【商品券等】", TextStyle::default().bold())?;
            for v in &report.vouchers {
                let label = if let Some(ref memo) = v.memo {
                    format!("{} ({})", v.voucher_type, memo)
                } else {
                    v.voucher_type.clone()
                };
                printer.row_auto(&label, &format_price(v.amount))?;
            }
            printer.row_auto_bold("商品券等合計:", &format_price(report.voucher_total))?;
            printer.separator()?;
        }

        // 合計と差異
        printer.jp_textln("【精算】", TextStyle::default().bold())?;
        printer.row_auto_bold("実査合計:", &format_price(report.grand_total))?;
        printer.row_auto("売上合計:", &format_price(report.expected_total))?;

        let diff_str = if report.difference >= 0 {
            format!("+{}", format_price(report.difference as u32))
        } else {
            format!("-{}", format_price((-report.difference) as u32))
        };
        printer.row_auto_bold("差異:", &diff_str)?;

        printer.textln("")?;
        printer.separator()?;

        // フッター
        printer.jp_textln("このレポートは閉局処理の記録です", TextStyle::default().center())?;

        printer.feed(3)?;
        printer.cut()?;

        Ok(())
    }
}

// Android Bluetooth printer implementation
#[cfg(target_os = "android")]
mod android_printer {
    #[derive(Debug, Clone, serde::Serialize)]
    pub struct BluetoothDevice {
        pub address: String,
        pub name: String,
    }

    #[tauri::command]
    pub async fn get_bluetooth_devices() -> Result<Vec<BluetoothDevice>, String> {
        // TODO: Implement Bluetooth device discovery via JNI
        // For now, return empty list
        Ok(vec![])
    }

    #[tauri::command]
    pub fn connect_bluetooth_printer(address: String) -> Result<(), String> {
        // TODO: Implement Bluetooth connection
        Err("Bluetooth printer not yet implemented".to_string())
    }

    #[tauri::command]
    pub fn bluetooth_print(
        address: String,
        text: String,
        paper_width: Option<u8>,
    ) -> Result<(), String> {
        // TODO: Implement Bluetooth printing
        Err("Bluetooth printing not yet implemented".to_string())
    }

    #[tauri::command]
    pub fn bluetooth_welcome_print(
        address: String,
        id: String,
        paper_width: Option<u8>,
    ) -> Result<(), String> {
        // TODO: Implement Bluetooth welcome print
        Err("Bluetooth printing not yet implemented".to_string())
    }
}

// Common commands available on all platforms
mod common {
    #[tauri::command]
    pub fn get_platform() -> String {
        #[cfg(target_os = "android")]
        return "android".to_string();

        #[cfg(target_os = "ios")]
        return "ios".to_string();

        #[cfg(target_os = "macos")]
        return "macos".to_string();

        #[cfg(target_os = "windows")]
        return "windows".to_string();

        #[cfg(target_os = "linux")]
        return "linux".to_string();

        #[cfg(not(any(
            target_os = "android",
            target_os = "ios",
            target_os = "macos",
            target_os = "windows",
            target_os = "linux"
        )))]
        return "unknown".to_string();
    }
}

// 端末認証コマンド
mod terminal_commands {
    use crate::terminal_auth;

    /// 端末の状態を取得
    #[tauri::command]
    pub fn get_terminal_status() -> Result<terminal_auth::TerminalAuthResult, String> {
        terminal_auth::get_terminal_status().map_err(|e| e.to_string())
    }

    /// 端末を初期化（キーペア生成）
    #[tauri::command]
    pub fn initialize_terminal(
        device_name: String,
    ) -> Result<terminal_auth::RegistrationQrPayload, String> {
        terminal_auth::initialize_terminal(&device_name).map_err(|e| e.to_string())
    }

    /// QRコード用のJSONデータを生成
    #[tauri::command]
    pub fn generate_registration_qr(
        device_name: String,
    ) -> Result<String, String> {
        // 既に初期化されている場合は現在の状態を返す
        let status = terminal_auth::get_terminal_status().map_err(|e| e.to_string())?;

        let payload = if status.status == "initialized" {
            // 既存のデータからペイロードを構築
            terminal_auth::RegistrationQrPayload {
                v: 1,
                terminal_id: status.terminal_id.unwrap_or_default(),
                public_key: status.public_key.unwrap_or_default(),
                device_name,
                os: get_os_type(),
                created_at: "".to_string(), // 既存のため空
            }
        } else {
            // 新規初期化
            terminal_auth::initialize_terminal(&device_name).map_err(|e| e.to_string())?
        };

        serde_json::to_string(&payload).map_err(|e| e.to_string())
    }

    /// 認証用の署名データを生成
    #[tauri::command]
    pub fn create_auth_signature() -> Result<terminal_auth::SignatureData, String> {
        terminal_auth::create_auth_signature().map_err(|e| e.to_string())
    }

    /// Keychainをクリア（デバッグ用）
    #[tauri::command]
    pub fn clear_terminal_keychain() -> Result<(), String> {
        terminal_auth::clear_keychain().map_err(|e| e.to_string())
    }

    fn get_os_type() -> String {
        #[cfg(target_os = "macos")]
        return "macos".to_string();

        #[cfg(target_os = "windows")]
        return "windows".to_string();

        #[cfg(target_os = "linux")]
        return "linux".to_string();

        #[cfg(target_os = "android")]
        return "android".to_string();

        #[cfg(not(any(
            target_os = "macos",
            target_os = "windows",
            target_os = "linux",
            target_os = "android"
        )))]
        return "unknown".to_string();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            common::get_platform,
            // 端末認証コマンド
            terminal_commands::get_terminal_status,
            terminal_commands::initialize_terminal,
            terminal_commands::generate_registration_qr,
            terminal_commands::create_auth_signature,
            terminal_commands::clear_terminal_keychain,
            // プリンターコマンド（デスクトップ）
            #[cfg(not(target_os = "android"))]
            desktop_printer::get_usb_devices,
            #[cfg(not(target_os = "android"))]
            desktop_printer::text_print,
            #[cfg(not(target_os = "android"))]
            desktop_printer::welcome_print,
            #[cfg(not(target_os = "android"))]
            desktop_printer::print_receipt,
            #[cfg(not(target_os = "android"))]
            desktop_printer::print_closing_report,
            // プリンターコマンド（Android）
            #[cfg(target_os = "android")]
            android_printer::get_bluetooth_devices,
            #[cfg(target_os = "android")]
            android_printer::connect_bluetooth_printer,
            #[cfg(target_os = "android")]
            android_printer::bluetooth_print,
            #[cfg(target_os = "android")]
            android_printer::bluetooth_welcome_print,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
