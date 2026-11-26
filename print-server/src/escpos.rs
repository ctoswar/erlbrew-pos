//! ESC/POS byte builders.
//!
//! The output is byte-for-byte identical to the Python implementation
//! (`format_receipt_57mm`, `format_receipt_58mm`, `format_receipt_80mm` and
//! `make_qr_escpos`) so existing printers keep producing the same receipts.

/// `ESC @` — initialise printer (clears the buffer, returns to defaults).
pub const INIT: &[u8] = &[0x1B, 0x40];
/// `ESC p 0 25 120` — drawer kick, 50 ms on / 240 ms off (most printers).
pub const CASH_DRAWER_PRIMARY: &[u8] = &[0x1B, 0x70, 0x00, 0x19, 0x78];
/// `ESC p 0 19 78` — alternate polarity (38 ms on / 156 ms off).
pub const CASH_DRAWER_FALLBACK: &[u8] = &[0x1B, 0x70, 0x00, 0x13, 0x4E];

const ALIGN_LEFT: &[u8] = &[0x1B, 0x61, 0x00];
const ALIGN_CENTER: &[u8] = &[0x1B, 0x61, 0x01];
const BOLD_ON: &[u8] = &[0x1B, 0x45, 0x01];
const BOLD_OFF: &[u8] = &[0x1B, 0x45, 0x00];
const FULL_CUT: &[u8] = &[0x1D, 0x56, 0x00];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaperSize {
    /// 57 mm roll — QR modules of 3, 4-line feed.
    P57,
    /// 58 mm roll — QR modules of 4, 4-line feed.
    P58,
    /// 80 mm roll — QR modules of 5, 5-line feed.
    P80,
}

impl PaperSize {
    /// Unknown sizes fall back to 80 mm, exactly like the Python `else` branch.
    pub fn parse(raw: &str) -> Self {
        match raw.trim() {
            "57mm" => Self::P57,
            "58mm" => Self::P58,
            _ => Self::P80,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::P57 => "57mm",
            Self::P58 => "58mm",
            Self::P80 => "80mm",
        }
    }

    fn qr_module_size(self) -> u8 {
        match self {
            Self::P57 => 3,
            Self::P58 => 4,
            Self::P80 => 5,
        }
    }

    fn feed_lines(self) -> u8 {
        match self {
            Self::P80 => 5,
            _ => 4,
        }
    }
}

/// Builds a complete ESC/POS QR command sequence using `GS ( k`.
///
/// Sequence: select model 2 → error correction M → module size → store data →
/// print stored symbol.
pub fn qr(data: &str, module_size: u8) -> Vec<u8> {
    if data.is_empty() {
        return Vec::new();
    }

    let data = data.as_bytes();
    let len = data.len() + 3;
    let pl = (len % 256) as u8;
    let ph = (len / 256) as u8;
    let module_size = module_size.clamp(3, 8);

    let mut out = Vec::with_capacity(data.len() + 40);
    // Select QR model (model 2)
    out.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // Error correction level M
    out.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x32]);
    // Module size
    out.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, module_size]);
    // Store the data
    out.extend_from_slice(&[0x1D, 0x28, 0x6B, pl, ph, 0x31, 0x50, 0x30]);
    out.extend_from_slice(data);
    // Print the stored symbol
    out.extend_from_slice(&[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);
    out
}

/// Renders the receipt body (text lines, optional QR codes, feed + cut).
pub fn receipt(
    lines: &[String],
    paper: PaperSize,
    qr_code_url: Option<&str>,
    wifi_qr_data: Option<&str>,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(INIT.len() + lines.len() * 48 + 256);
    out.extend_from_slice(INIT);

    for line in lines {
        let stripped = line.trim();
        // The Python server centres every line that has no leading whitespace.
        let is_center = line.len() == line.trim_start().len() && !stripped.is_empty();
        let align = if is_center { ALIGN_CENTER } else { ALIGN_LEFT };

        // 57/58 mm bold on `===` and `---` rules; 80 mm only on `===`.
        let is_rule =
            stripped.starts_with("===") || (paper != PaperSize::P80 && stripped.starts_with("---"));

        if is_rule {
            out.extend_from_slice(BOLD_ON);
            out.extend_from_slice(align);
            if paper == PaperSize::P80 {
                out.extend_from_slice(format!("{:^48}", stripped).as_bytes());
            } else {
                out.extend_from_slice(stripped.as_bytes());
            }
            out.push(b'\n');
            out.extend_from_slice(BOLD_OFF);
        } else {
            out.extend_from_slice(align);
            out.extend_from_slice(line.as_bytes());
            out.push(b'\n');
        }
    }

    if let Some(url) = qr_code_url.filter(|u| !u.is_empty()) {
        let bytes = qr(url, paper.qr_module_size());
        if !bytes.is_empty() {
            out.extend_from_slice(ALIGN_CENTER);
            out.extend_from_slice(&bytes);
            out.push(b'\n');
            out.extend_from_slice(b"Scan QR for more info");
            out.push(b'\n');
            out.push(b'\n');
        }
    }

    if let Some(data) = wifi_qr_data.filter(|d| !d.is_empty()) {
        let bytes = qr(data, paper.qr_module_size().max(4));
        if !bytes.is_empty() {
            out.extend_from_slice(ALIGN_CENTER);
            out.extend_from_slice(&bytes);
            out.push(b'\n');
            out.extend_from_slice(b"Scan QR to join Wi-Fi");
            out.push(b'\n');
            out.push(b'\n');
        }
    }

    // Feed then cut.
    out.extend_from_slice(&[0x1B, 0x64, paper.feed_lines()]);
    out.extend_from_slice(FULL_CUT);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    #[test]
    fn plain_receipt_centres_unindented_lines() {
        let raw = receipt(&lines(&["HELLO", " item"]), PaperSize::P58, None, None);
        let mut expected = Vec::new();
        expected.extend_from_slice(INIT);
        expected.extend_from_slice(ALIGN_CENTER);
        expected.extend_from_slice(b"HELLO\n");
        expected.extend_from_slice(ALIGN_LEFT);
        expected.extend_from_slice(b" item\n");
        expected.extend_from_slice(&[0x1B, 0x64, 0x04]);
        expected.extend_from_slice(FULL_CUT);
        assert_eq!(raw, expected);
    }

    #[test]
    fn bold_rules_differ_between_58mm_and_80mm() {
        // 58 mm: `---` is bold, printed stripped.
        let raw58 = receipt(&lines(&["---"]), PaperSize::P58, None, None);
        assert!(raw58.windows(BOLD_ON.len()).any(|w| w == BOLD_ON));

        // 80 mm: `---` is not a rule, printed verbatim.
        let raw80 = receipt(&lines(&["---"]), PaperSize::P80, None, None);
        assert!(!raw80.windows(BOLD_ON.len()).any(|w| w == BOLD_ON));

        // 80 mm: `===` is bold and centred to 48 columns.
        let raw80 = receipt(&lines(&["==="]), PaperSize::P80, None, None);
        assert!(raw80.windows(BOLD_ON.len()).any(|w| w == BOLD_ON));
        let padded = format!("{:^48}", "===");
        assert!(raw80.windows(padded.len()).any(|w| w == padded.as_bytes()));
    }

    #[test]
    fn qr_sequence_matches_python() {
        let bytes = qr("hi", 4);
        let expected = [
            &[0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00][..],
            &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x32][..],
            &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04][..],
            &[0x1D, 0x28, 0x6B, 5, 0x00, 0x31, 0x50, 0x30][..],
            b"hi",
            &[0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30][..],
        ]
        .concat();
        assert_eq!(bytes, expected);
    }

    #[test]
    fn qr_module_size_is_clamped() {
        let small = qr("x", 1);
        let big = qr("x", 99);
        // Module size lives at the end of the third `GS ( k` block (offset 24).
        assert_eq!(small[24], 3);
        assert_eq!(big[24], 8);
        assert!(qr("", 4).is_empty());
    }

    #[test]
    fn feed_and_cut_per_paper_size() {
        let raw57 = receipt(&[], PaperSize::P57, None, None);
        assert_eq!(
            &raw57[raw57.len() - 6..],
            &[0x1B, 0x64, 0x04, 0x1D, 0x56, 0x00]
        );

        let raw80 = receipt(&[], PaperSize::P80, None, None);
        assert_eq!(
            &raw80[raw80.len() - 6..],
            &[0x1B, 0x64, 0x05, 0x1D, 0x56, 0x00]
        );
    }

    #[test]
    fn qr_url_is_printed_before_feed_and_cut() {
        let raw = receipt(&lines(&["A"]), PaperSize::P57, Some("https://x.test"), None);
        let needle = b"Scan QR for more info";
        let qr_pos = raw
            .windows(needle.len())
            .position(|w| w == needle)
            .expect("label present");
        let cut_pos = raw
            .windows(FULL_CUT.len())
            .position(|w| w == FULL_CUT)
            .expect("cut present");
        assert!(qr_pos < cut_pos);
    }
}
