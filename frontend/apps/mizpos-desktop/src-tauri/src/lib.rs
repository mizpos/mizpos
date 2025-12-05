// Desktop-only modules
#[cfg(not(target_os = "android"))]
mod jp_escpos;

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
        /// JAN
        pub jan: String,
        /// ISBN
        pub isbn: String,
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

    /// レシートデータ
    #[derive(Debug, Clone, Deserialize)]
    pub struct ReceiptData {
        /// イベント名称
        pub event_name: String,
        /// スタッフ番号
        pub staff_id: String,
        /// 宛名（様の前に表示）
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
    }

    #[tauri::command]
    pub async fn get_usb_devices() -> Result<Vec<DeviceInfo>, String> {
        let device_list = nusb::list_devices()
            .await
            .map_err(|e| {
                e.to_string()
            })?;


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
    fn format_price(price: u32) -> String {
        let s = price.to_string();
        let mut result = String::new();
        for (i, c) in s.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 {
                result.insert(0, ',');
            }
            result.insert(0, c);
        }
        format!("¥{}", result)
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

        // イベント名称
        printer.jp_textln(&receipt.event_name, TextStyle::default().center())?;

        // 責ID: {スタッフ番号}
        printer.jp_textln(&format!("責ID:{}", receipt.staff_id), TextStyle::default())?;

        // 領収書（黒背景中央揃え文字２倍サイズ）
        printer.jp_textln_padded("ご明細書", TextStyle::default().double().reverse().center())?;

        printer.textln("")?;

        // 様（右寄せ黒背景文字２倍サイズ下線）
        if let Some(ref name) = receipt.customer_name {
            let customer_line = format!("{}　様", name);
            printer.jp_textln_padded(&customer_line, TextStyle::default().double().reverse().underline().right())?;
        } else {
            printer.jp_textln_padded("　　　　　　　　　様", TextStyle::default().double().reverse().underline().right())?;
        }

        printer.textln("")?;

        // お買上明細（中央揃え）
        printer.jp_textln("お買上明細", TextStyle::default().center())?;

        printer.separator()?;

        // 商品明細
        for item in &receipt.items {
            // {出版サークル}    {JAN}
            printer.row_auto(&item.circle_name, &item.jan)?;
            // 　　{ISBN}    商品数    値段
            let quantity_price = format!("{}点    {}", item.quantity, format_price(item.price));
            printer.row_auto(&format!("  {}", item.isbn), &quantity_price)?;
        }

        printer.separator()?;

        // 合計（右寄せ、全角数字）
        let total_fullwidth = to_fullwidth_number(receipt.total);
        printer.jp_textln(&format!("合計　　¥{}", total_fullwidth), TextStyle::default().right().bold())?;

        printer.textln("")?;

        // 支払情報
        for payment in &receipt.payments {
            printer.row_auto(&payment.method, &format_price(payment.amount))?;
        }

        // 内消費税
        printer.jp_textln(
            &format!("　　（内消費税{}%　{}）", receipt.tax_rate, format_price(receipt.tax_amount)),
            TextStyle::default().right()
        )?;

        printer.separator()?;

        // レシート番号
        printer.row_auto("レシート番号", &receipt.receipt_number)?;

        printer.textln("")?;

        // QRコード（レシート番号）
        printer.qr_code_center(&receipt.receipt_number, Some(6))?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            common::get_platform,
            #[cfg(not(target_os = "android"))]
            desktop_printer::get_usb_devices,
            #[cfg(not(target_os = "android"))]
            desktop_printer::text_print,
            #[cfg(not(target_os = "android"))]
            desktop_printer::welcome_print,
            #[cfg(not(target_os = "android"))]
            desktop_printer::print_receipt,
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
