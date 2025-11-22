// Desktop-only modules
#[cfg(not(target_os = "android"))]
mod jp_escpos;

// Desktop USB printer implementation
#[cfg(not(target_os = "android"))]
mod desktop_printer {
    use escpos::driver::NativeUsbDriver;
    use crate::jp_escpos::{JpPrinter, PaperWidth, TextStyle};

    #[derive(Debug, Clone, serde::Serialize)]
    pub struct DeviceInfo {
        pub vendor_id: u16,
        pub device_id: u16,
        pub name: String,
    }

    #[tauri::command]
    pub async fn get_usb_devices() -> Result<Vec<DeviceInfo>, String> {
        println!("[get_usb_devices] Starting...");

        let device_list = nusb::list_devices()
            .await
            .map_err(|e| {
                println!("[get_usb_devices] Error listing devices: {}", e);
                e.to_string()
            })?;

        println!("[get_usb_devices] Got device list, collecting...");

        let devices: Vec<DeviceInfo> = device_list
            .map(|device_info| {
                let vendor_id = device_info.vendor_id();
                let product_id = device_info.product_id();
                let name = device_info
                    .product_string()
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                println!("[get_usb_devices] Found: {:04x}:{:04x} - {}", vendor_id, product_id, name);
                DeviceInfo {
                    vendor_id,
                    device_id: product_id,
                    name,
                }
            })
            .collect();

        println!("[get_usb_devices] Done, found {} devices", devices.len());
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
        .invoke_handler(tauri::generate_handler![
            common::get_platform,
            #[cfg(not(target_os = "android"))]
            desktop_printer::get_usb_devices,
            #[cfg(not(target_os = "android"))]
            desktop_printer::text_print,
            #[cfg(not(target_os = "android"))]
            desktop_printer::welcome_print,
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
