mod jp_escpos;

use escpos::driver::NativeUsbDriver;
use jp_escpos::{JpPrinter, PaperWidth, TextStyle};

#[derive(Debug, Clone, serde::Serialize)]
struct DeviceInfo {
    vendor_id: u16,
    device_id: u16,
    name: String,
}


#[tauri::command]
async fn get_usb_devices() -> Result<Vec<DeviceInfo>, String> {
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
fn welcome_print(
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
fn text_print(
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_usb_devices, text_print, welcome_print])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}