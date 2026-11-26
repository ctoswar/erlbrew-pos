//! CUPS transport — pipes raw ESC/POS bytes into `lpr`.

use std::io::{self, Write};
use std::process::{Command, Stdio};

/// Sends `data` to the CUPS queue `printer` via `lpr -P <printer>`.
pub fn send(printer: &str, data: &[u8]) -> io::Result<()> {
    let mut child = Command::new("lpr")
        .arg("-P")
        .arg(printer)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| io::Error::other("lpr stdin unavailable"))?;
        stdin.write_all(data)?;
        stdin.flush()?;
    }

    let output = child.wait_with_output()?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(io::Error::other(if stderr.is_empty() {
            format!("lpr exited with {}", output.status)
        } else {
            stderr
        }))
    }
}
