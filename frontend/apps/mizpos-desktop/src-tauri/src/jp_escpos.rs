#![allow(dead_code)]

use encoding_rs::SHIFT_JIS;
use escpos::driver::Driver;

pub const HW_INIT: &[u8] = b"\x1b\x40";
pub const CTL_LF: &[u8] = b"\x0a";
pub const PAPER_FULL_CUT: &[u8] = b"\x1d\x56\x00";
pub const PAPER_PART_CUT: &[u8] = b"\x1d\x56\x01";

pub const TXT_BOLD_ON: &[u8] = b"\x1b\x45\x01";
pub const TXT_BOLD_OFF: &[u8] = b"\x1b\x45\x00";
pub const TXT_UNDERL_ON: &[u8] = b"\x1b\x2d\x01";
pub const TXT_UNDERL_OFF: &[u8] = b"\x1b\x2d\x00";
pub const TXT_ALIGN_LT: &[u8] = b"\x1b\x61\x00";
pub const TXT_ALIGN_CT: &[u8] = b"\x1b\x61\x01";
pub const TXT_ALIGN_RT: &[u8] = b"\x1b\x61\x02";

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
    pub align: Align,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            bold: false,
            underline: false,
            double_width: false,
            double_height: false,
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
            self.raw(TXT_UNDERL_ON)
        } else {
            self.raw(TXT_UNDERL_OFF)
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

        self.raw(JP_KANJI_MODE_ON)?;

        let size_flag = {
            let mut n: u8 = 0x00;
            if style.double_width {
                n |= 0x04;
            }
            if style.double_height {
                n |= 0x08;
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

        self.set_bold(false)?;
        self.set_underline(false)?;
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

    pub fn row(&mut self, left: &str, right: &str, width: usize) -> Result<(), String> {
        let left_len = left.chars().count();
        let right_len = right.chars().count();
        let space_len = width.saturating_sub(left_len + right_len);
        let spaces = " ".repeat(space_len);
        let row = format!("{}{}{}", left, spaces, right);
        self.textln(&row)
    }

    pub fn row_auto(&mut self, left: &str, right: &str) -> Result<(), String> {
        self.row(left, right, self.paper_width.chars())
    }
}
