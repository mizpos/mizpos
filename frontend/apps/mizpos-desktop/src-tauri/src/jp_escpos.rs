#![allow(dead_code)]

use encoding_rs::SHIFT_JIS;
use escpos::driver::Driver;

pub const HW_INIT: &[u8] = b"\x1b\x40";
pub const CTL_LF: &[u8] = b"\x0a";
pub const PAPER_FULL_CUT: &[u8] = b"\x1d\x56\x00";
pub const PAPER_PART_CUT: &[u8] = b"\x1d\x56\x01";

pub const TXT_BOLD_ON: &[u8] = b"\x1b\x45\x01";
pub const TXT_BOLD_OFF: &[u8] = b"\x1b\x45\x00";
// ESC - for ASCII/Kana underline
pub const TXT_UNDERL_ON: &[u8] = b"\x1b\x2d\x01";
pub const TXT_UNDERL_OFF: &[u8] = b"\x1b\x2d\x00";
// FS - for Kanji underline
pub const JP_UNDERL_ON: &[u8] = b"\x1c\x2d\x01";
pub const JP_UNDERL_OFF: &[u8] = b"\x1c\x2d\x00";
pub const TXT_ALIGN_LT: &[u8] = b"\x1b\x61\x00";
pub const TXT_ALIGN_CT: &[u8] = b"\x1b\x61\x01";
pub const TXT_ALIGN_RT: &[u8] = b"\x1b\x61\x02";

// Reverse (black background, white text)
pub const TXT_REVERSE_ON: &[u8] = b"\x1dB\x01";
pub const TXT_REVERSE_OFF: &[u8] = b"\x1dB\x00";

// Double size text (ESC !)
pub const TXT_DOUBLE_SIZE: &[u8] = b"\x1b!\x30"; // double width + double height
pub const TXT_NORMAL_SIZE: &[u8] = b"\x1b!\x00";

// QR Code commands (GS ( k) - Citizen ESC/POS
// fn=165 (0xA5): Select model
// fn=167 (0xA7): Set cell size
// fn=169 (0xA9): Set error correction level
// fn=180 (0xB4): Store data
// fn=181 (0xB5): Print symbol
pub const QR_MODEL_2: &[u8] = &[0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0xA5, 0x32, 0x00];
pub const QR_SIZE_PREFIX: &[u8] = &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0xA7];
pub const QR_ERROR_L: &[u8] = &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0xA9, 0x30];
pub const QR_ERROR_M: &[u8] = &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0xA9, 0x31];
pub const QR_PRINT: &[u8] = &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0xB5, 0x30];

pub const JP_CHARCODE_JIS: &[u8] = b"\x1b\x74\x02";
pub const JP_KANJI_SELECT: &[u8] = b"\x1c\x43\x01";
pub const JP_KANJI_MODE_ON: &[u8] = b"\x1c\x26";
pub const JP_KANJI_MODE_OFF: &[u8] = b"\x1c\x2e";
pub const JP_KANJI_SIZE_CMD: &[u8] = b"\x1c\x21";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaperWidth {
    Mm58,
    Mm80,
}

impl PaperWidth {
    pub fn dots(&self) -> u16 {
        match self {
            PaperWidth::Mm58 => 384,
            PaperWidth::Mm80 => 576,
        }
    }

    pub fn chars(&self) -> usize {
        match self {
            PaperWidth::Mm58 => 32,
            PaperWidth::Mm80 => 48,
        }
    }

    pub fn chars_jp(&self) -> usize {
        match self {
            PaperWidth::Mm58 => 16,
            PaperWidth::Mm80 => 24,
        }
    }
}

impl Default for PaperWidth {
    fn default() -> Self {
        PaperWidth::Mm58
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Align {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, Copy)]
pub struct TextStyle {
    pub bold: bool,
    pub underline: bool,
    pub double_width: bool,
    pub double_height: bool,
    pub reverse: bool,
    pub align: Align,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            bold: false,
            underline: false,
            double_width: false,
            double_height: false,
            reverse: false,
            align: Align::Left,
        }
    }
}

impl TextStyle {
    pub fn bold(mut self) -> Self {
        self.bold = true;
        self
    }

    pub fn underline(mut self) -> Self {
        self.underline = true;
        self
    }

    pub fn double_width(mut self) -> Self {
        self.double_width = true;
        self
    }

    pub fn double_height(mut self) -> Self {
        self.double_height = true;
        self
    }

    pub fn align(mut self, align: Align) -> Self {
        self.align = align;
        self
    }

    pub fn center(self) -> Self {
        self.align(Align::Center)
    }

    pub fn right(self) -> Self {
        self.align(Align::Right)
    }

    pub fn reverse(mut self) -> Self {
        self.reverse = true;
        self
    }

    pub fn double(self) -> Self {
        self.double_width().double_height()
    }
}

pub struct JpPrinter<D: Driver> {
    driver: D,
    paper_width: PaperWidth,
}

impl<D: Driver> JpPrinter<D> {
    pub fn new(driver: D) -> Self {
        Self {
            driver,
            paper_width: PaperWidth::default(),
        }
    }

    pub fn with_paper_width(driver: D, paper_width: PaperWidth) -> Self {
        Self {
            driver,
            paper_width,
        }
    }

    pub fn paper_width(&self) -> PaperWidth {
        self.paper_width
    }

    pub fn chars_per_line(&self) -> usize {
        self.paper_width.chars()
    }

    fn raw(&mut self, data: &[u8]) -> Result<(), String> {
        self.driver.write(data).map_err(|e| e.to_string())?;
        self.driver.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn init(&mut self) -> Result<(), String> {
        self.raw(HW_INIT)?;
        self.raw(JP_CHARCODE_JIS)?;
        self.raw(JP_KANJI_SELECT)?;
        self.set_print_area_width(self.paper_width.dots())?;
        Ok(())
    }

    pub fn set_left_margin(&mut self, dots: u16) -> Result<(), String> {
        let nl = (dots & 0xFF) as u8;
        let nh = ((dots >> 8) & 0xFF) as u8;
        self.raw(&[0x1D, 0x4C, nl, nh])
    }

    pub fn set_print_area_width(&mut self, dots: u16) -> Result<(), String> {
        let nl = (dots & 0xFF) as u8;
        let nh = ((dots >> 8) & 0xFF) as u8;
        self.raw(&[0x1D, 0x57, nl, nh])
    }

    pub fn feed(&mut self, lines: u8) -> Result<(), String> {
        for _ in 0..lines {
            self.raw(CTL_LF)?;
        }
        Ok(())
    }

    pub fn cut(&mut self) -> Result<(), String> {
        self.raw(PAPER_FULL_CUT)
    }

    pub fn partial_cut(&mut self) -> Result<(), String> {
        self.raw(PAPER_PART_CUT)
    }

    fn set_align(&mut self, align: Align) -> Result<(), String> {
        match align {
            Align::Left => self.raw(TXT_ALIGN_LT),
            Align::Center => self.raw(TXT_ALIGN_CT),
            Align::Right => self.raw(TXT_ALIGN_RT),
        }
    }

    fn set_bold(&mut self, on: bool) -> Result<(), String> {
        if on {
            self.raw(TXT_BOLD_ON)
        } else {
            self.raw(TXT_BOLD_OFF)
        }
    }

    fn set_underline(&mut self, on: bool) -> Result<(), String> {
        if on {
            // 英数カナ用と漢字用の両方を設定
            self.raw(TXT_UNDERL_ON)?;
            self.raw(JP_UNDERL_ON)
        } else {
            self.raw(TXT_UNDERL_OFF)?;
            self.raw(JP_UNDERL_OFF)
        }
    }

    fn set_reverse(&mut self, on: bool) -> Result<(), String> {
        if on {
            self.raw(TXT_REVERSE_ON)
        } else {
            self.raw(TXT_REVERSE_OFF)
        }
    }

    fn set_double_size(&mut self, on: bool) -> Result<(), String> {
        if on {
            self.raw(TXT_DOUBLE_SIZE)
        } else {
            self.raw(TXT_NORMAL_SIZE)
        }
    }

    fn encode_shift_jis(&self, text: &str) -> Vec<u8> {
        let (encoded, _, _) = SHIFT_JIS.encode(text);
        encoded.into_owned()
    }

    pub fn text(&mut self, txt: &str) -> Result<(), String> {
        self.jp_text(txt, TextStyle::default())
    }

    pub fn textln(&mut self, txt: &str) -> Result<(), String> {
        self.jp_textln(txt, TextStyle::default())
    }

    pub fn jp_text(&mut self, txt: &str, style: TextStyle) -> Result<(), String> {
        self.set_align(style.align)?;
        self.set_bold(style.bold)?;
        self.set_underline(style.underline)?;
        self.set_reverse(style.reverse)?;

        // Use ESC ! for double size (works better with reverse)
        let use_double_size = style.double_width && style.double_height;
        if use_double_size {
            self.set_double_size(true)?;
        }

        self.raw(JP_KANJI_MODE_ON)?;

        let size_flag = {
            let mut n: u8 = 0x00;
            // Only use kanji size command if not using ESC !
            if !use_double_size {
                if style.double_width {
                    n |= 0x04;
                }
                if style.double_height {
                    n |= 0x08;
                }
            }
            n
        };

        if size_flag != 0x00 {
            let mut cmd = JP_KANJI_SIZE_CMD.to_vec();
            cmd.push(size_flag);
            self.raw(&cmd)?;
        }

        let encoded = self.encode_shift_jis(txt);
        self.raw(&encoded)?;

        if size_flag != 0x00 {
            let mut cmd = JP_KANJI_SIZE_CMD.to_vec();
            cmd.push(0x00);
            self.raw(&cmd)?;
        }

        self.raw(JP_KANJI_MODE_OFF)?;

        if use_double_size {
            self.set_double_size(false)?;
        }

        self.set_bold(false)?;
        self.set_underline(false)?;
        self.set_reverse(false)?;
        self.set_align(Align::Left)?;

        Ok(())
    }

    pub fn jp_textln(&mut self, txt: &str, style: TextStyle) -> Result<(), String> {
        self.jp_text(txt, style)?;
        self.feed(1)
    }

    pub fn line(&mut self, width: usize) -> Result<(), String> {
        let line = "-".repeat(width);
        self.textln(&line)
    }

    pub fn separator(&mut self) -> Result<(), String> {
        self.line(self.paper_width.chars())
    }

    pub fn double_line(&mut self, width: usize) -> Result<(), String> {
        let line = "=".repeat(width);
        self.textln(&line)
    }

    pub fn double_separator(&mut self) -> Result<(), String> {
        self.double_line(self.paper_width.chars())
    }

    /// 文字列の印刷幅を計算（全角文字は2、半角文字は1）
    fn print_width(s: &str) -> usize {
        s.chars().map(|c| {
            // ASCII範囲内は半角（1）、それ以外は全角（2）
            if c as u32 <= 0x7F {
                1
            } else {
                2
            }
        }).sum()
    }

    pub fn row(&mut self, left: &str, right: &str, width: usize) -> Result<(), String> {
        let left_len = Self::print_width(left);
        let right_len = Self::print_width(right);
        let space_len = width.saturating_sub(left_len + right_len);
        let spaces = " ".repeat(space_len);
        let row = format!("{}{}{}", left, spaces, right);
        self.textln(&row)
    }

    pub fn row_auto(&mut self, left: &str, right: &str) -> Result<(), String> {
        self.row(left, right, self.paper_width.chars())
    }

    /// Print QR code (ESC/POS)
    /// size: 1-16 (default: 4)
    pub fn qr_code(&mut self, data: &str, size: Option<u8>) -> Result<(), String> {
        let size = size.unwrap_or(4).clamp(1, 16);

        // fn=165 (0xA5): Select model 2
        self.raw(QR_MODEL_2)?;

        // fn=167 (0xA7): Set cell size
        let mut size_cmd = QR_SIZE_PREFIX.to_vec();
        size_cmd.push(size);
        self.raw(&size_cmd)?;

        // fn=169 (0xA9): Set error correction level M
        self.raw(QR_ERROR_M)?;

        // fn=180 (0xB4): Store data in symbol storage area
        // Command: GS ( k pL pH cn fn m d1...dk
        // cn=49 (0x31), fn=180 (0xB4), m=48 (0x30)
        let data_bytes = data.as_bytes();
        let len = data_bytes.len() + 3; // +3 for cn, fn, m
        let pl = (len & 0xFF) as u8;
        let ph = ((len >> 8) & 0xFF) as u8;

        let mut store_cmd = vec![0x1D, 0x28, 0x6B, pl, ph, 0x31, 0xB4, 0x30];
        store_cmd.extend_from_slice(data_bytes);
        self.raw(&store_cmd)?;

        // fn=181 (0xB5): Print QR code
        self.raw(QR_PRINT)?;

        Ok(())
    }

    /// Print QR code centered
    pub fn qr_code_center(&mut self, data: &str, size: Option<u8>) -> Result<(), String> {
        self.set_align(Align::Center)?;
        self.qr_code(data, size)?;
        self.set_align(Align::Left)?;
        Ok(())
    }

    /// Print CODE128 barcode
    /// GS k m n d1...dn
    /// m = 73 (0x49) for CODE128
    /// height: barcode height in dots (default: 50)
    /// width: barcode module width 2-6 (default: 2)
    pub fn barcode_code128(&mut self, data: &str, height: Option<u8>, width: Option<u8>) -> Result<(), String> {
        let height = height.unwrap_or(50);
        let width = width.unwrap_or(2).clamp(2, 6);

        // GS H n - HRI character print position: 2 = below barcode
        self.raw(&[0x1D, 0x48, 0x02])?;

        // GS h n - Set barcode height
        self.raw(&[0x1D, 0x68, height])?;

        // GS w n - Set barcode width
        self.raw(&[0x1D, 0x77, width])?;

        // GS k m n d1...dn - Print barcode
        // m = 73 (0x49) for CODE128
        let data_bytes = data.as_bytes();
        let n = data_bytes.len() as u8;
        let mut cmd = vec![0x1D, 0x6B, 0x49, n];
        cmd.extend_from_slice(data_bytes);
        self.raw(&cmd)?;

        Ok(())
    }

    /// Print CODE128 barcode centered
    pub fn barcode_code128_center(&mut self, data: &str, height: Option<u8>, width: Option<u8>) -> Result<(), String> {
        self.set_align(Align::Center)?;
        self.barcode_code128(data, height, width)?;
        self.set_align(Align::Left)?;
        Ok(())
    }

    /// Print text with padding to fill line (for reverse style)
    pub fn jp_textln_padded(&mut self, txt: &str, style: TextStyle) -> Result<(), String> {
        let char_width = Self::print_width(txt);
        // 倍角の場合は各文字が2倍幅になるため、行幅も半分で計算
        let line_width = if style.double_width || (style.double_width && style.double_height) {
            self.paper_width.chars_jp()
        } else {
            self.paper_width.chars()
        };

        // 倍角時は印刷幅も2倍になるため、実効幅を調整
        let effective_char_width = if style.double_width {
            char_width // 倍角時はline_widthが既に半分なので、そのまま
        } else {
            char_width
        };

        let padded = match style.align {
            Align::Center => {
                let padding = line_width.saturating_sub(effective_char_width);
                let left_pad = padding / 2;
                let right_pad = padding - left_pad;
                format!("{}{}{}", " ".repeat(left_pad), txt, " ".repeat(right_pad))
            }
            Align::Right => {
                let padding = line_width.saturating_sub(effective_char_width);
                format!("{}{}", " ".repeat(padding), txt)
            }
            Align::Left => {
                let padding = line_width.saturating_sub(effective_char_width);
                format!("{}{}", txt, " ".repeat(padding))
            }
        };

        // Override align to left since we manually padded
        let mut left_style = style;
        left_style.align = Align::Left;
        self.jp_textln(&padded, left_style)
    }
}
