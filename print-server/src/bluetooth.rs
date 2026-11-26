//! Raw Bluetooth RFCOMM transport.
//!
//! No BlueZ/PyBluez dependency: we open an `AF_BLUETOOTH`/`BTPROTO_RFCOMM`
//! socket directly, exactly like the Python implementation, but the socket is
//! kept open between jobs so a receipt does not pay the 1–3 s handshake cost.

/// Parses `AA:BB:CC:DD:EE:FF` (or dash separated) into a `bdaddr_t` byte array.
///
/// `bdaddr_t` stores the address little-endian, i.e. the last octet first.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn parse_mac(mac: &str) -> Result<[u8; 6], String> {
    let parts: Vec<&str> = mac.split([':', '-']).collect();
    if parts.len() != 6 {
        return Err(format!("invalid Bluetooth MAC address: {mac}"));
    }

    let mut addr = [0u8; 6];
    for (i, part) in parts.iter().enumerate() {
        let octet = u8::from_str_radix(part.trim(), 16)
            .map_err(|_| format!("invalid Bluetooth MAC address: {mac}"))?;
        addr[5 - i] = octet;
    }
    Ok(addr)
}

#[cfg(target_os = "linux")]
mod imp {
    use std::io;
    use std::mem::size_of;
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd};
    use std::time::Duration;

    // From <bluetooth/bluetooth.h> / <sys/socket.h>
    const AF_BLUETOOTH: libc::c_int = 31;
    const BTPROTO_RFCOMM: libc::c_int = 3;

    /// Linux `struct sockaddr_rc` (`bdaddr_t` is packed, hence the trailing pad).
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct SockAddrRc {
        rc_family: libc::sa_family_t,
        rc_bdaddr: [u8; 6],
        rc_channel: u8,
    }

    pub struct BtConnection {
        fd: OwnedFd,
    }

    impl BtConnection {
        /// Connects to `mac` on `channel`, waiting at most `connect_timeout`.
        pub fn connect(
            mac: &str,
            channel: u8,
            connect_timeout: Duration,
            write_timeout: Duration,
        ) -> io::Result<Self> {
            let bdaddr = super::parse_mac(mac)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

            let raw = unsafe {
                libc::socket(
                    AF_BLUETOOTH,
                    libc::SOCK_STREAM | libc::SOCK_CLOEXEC,
                    BTPROTO_RFCOMM,
                )
            };
            if raw < 0 {
                return Err(io::Error::last_os_error());
            }
            // From here on the OwnedFd closes the socket on every error path.
            let fd = unsafe { OwnedFd::from_raw_fd(raw) };

            // Non-blocking connect so we can enforce our own timeout.
            let flags = unsafe { libc::fcntl(raw, libc::F_GETFL) };
            if flags < 0 {
                return Err(io::Error::last_os_error());
            }
            if unsafe { libc::fcntl(raw, libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0 {
                return Err(io::Error::last_os_error());
            }

            let addr = SockAddrRc {
                rc_family: AF_BLUETOOTH as libc::sa_family_t,
                rc_bdaddr: bdaddr,
                rc_channel: channel,
            };
            let rc = unsafe {
                libc::connect(
                    raw,
                    &addr as *const SockAddrRc as *const libc::sockaddr,
                    size_of::<SockAddrRc>() as libc::socklen_t,
                )
            };

            if rc != 0 {
                let err = io::Error::last_os_error();
                match err.raw_os_error() {
                    Some(libc::EINPROGRESS) | Some(libc::EALREADY) => {
                        wait_until_connected(raw, connect_timeout)?;
                    }
                    _ => return Err(err),
                }
            }

            // Restore blocking mode and cap how long a write may stall.
            if unsafe { libc::fcntl(raw, libc::F_SETFL, flags) } < 0 {
                return Err(io::Error::last_os_error());
            }
            set_send_timeout(raw, write_timeout)?;

            Ok(Self { fd })
        }

        /// Writes the whole buffer, tolerating short writes and `EINTR`.
        pub fn write_all(&mut self, mut data: &[u8]) -> io::Result<()> {
            while !data.is_empty() {
                let written = unsafe {
                    libc::send(
                        self.fd.as_raw_fd(),
                        data.as_ptr() as *const libc::c_void,
                        data.len(),
                        libc::MSG_NOSIGNAL,
                    )
                };
                if written < 0 {
                    let err = io::Error::last_os_error();
                    if err.kind() == io::ErrorKind::Interrupted {
                        continue;
                    }
                    return Err(err);
                }
                if written == 0 {
                    return Err(io::Error::new(
                        io::ErrorKind::WriteZero,
                        "bluetooth socket closed",
                    ));
                }
                data = &data[written as usize..];
            }
            Ok(())
        }
    }

    fn wait_until_connected(fd: RawFd, timeout: Duration) -> io::Result<()> {
        let mut pollfd = libc::pollfd {
            fd,
            events: libc::POLLOUT,
            revents: 0,
        };
        let millis = timeout.as_millis().min(i32::MAX as u128) as libc::c_int;

        loop {
            let rc = unsafe { libc::poll(&mut pollfd, 1, millis) };
            if rc < 0 {
                let err = io::Error::last_os_error();
                if err.kind() == io::ErrorKind::Interrupted {
                    continue;
                }
                return Err(err);
            }
            if rc == 0 {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "bluetooth connect timed out",
                ));
            }

            let mut so_error: libc::c_int = 0;
            let mut len = size_of::<libc::c_int>() as libc::socklen_t;
            let rc = unsafe {
                libc::getsockopt(
                    fd,
                    libc::SOL_SOCKET,
                    libc::SO_ERROR,
                    &mut so_error as *mut libc::c_int as *mut libc::c_void,
                    &mut len,
                )
            };
            if rc < 0 {
                return Err(io::Error::last_os_error());
            }
            if so_error != 0 {
                return Err(io::Error::from_raw_os_error(so_error));
            }
            return Ok(());
        }
    }

    fn set_send_timeout(fd: RawFd, timeout: Duration) -> io::Result<()> {
        let tv = libc::timeval {
            tv_sec: timeout.as_secs() as libc::time_t,
            tv_usec: timeout.subsec_micros() as libc::suseconds_t,
        };
        let rc = unsafe {
            libc::setsockopt(
                fd,
                libc::SOL_SOCKET,
                libc::SO_SNDTIMEO,
                &tv as *const libc::timeval as *const libc::c_void,
                size_of::<libc::timeval>() as libc::socklen_t,
            )
        };
        if rc < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}

#[cfg(not(target_os = "linux"))]
mod imp {
    use std::io;
    use std::time::Duration;

    /// Stub so the project builds and unit tests run on macOS/Windows dev boxes.
    pub struct BtConnection;

    impl BtConnection {
        pub fn connect(
            _mac: &str,
            _channel: u8,
            _connect_timeout: Duration,
            _write_timeout: Duration,
        ) -> io::Result<Self> {
            Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "Bluetooth printing requires Linux (AF_BLUETOOTH)",
            ))
        }

        pub fn write_all(&mut self, _data: &[u8]) -> io::Result<()> {
            Err(io::Error::new(io::ErrorKind::Unsupported, "not connected"))
        }
    }
}

pub use imp::BtConnection;

#[cfg(test)]
mod tests {
    use super::parse_mac;

    #[test]
    fn parses_colon_separated_mac_little_endian() {
        assert_eq!(
            parse_mac("02:15:BF:C6:F0:E6").unwrap(),
            [0xE6, 0xF0, 0xC6, 0xBF, 0x15, 0x02]
        );
    }

    #[test]
    fn parses_dash_separated_and_lowercase() {
        assert_eq!(
            parse_mac("02-15-bf-c6-f0-e6").unwrap(),
            [0xE6, 0xF0, 0xC6, 0xBF, 0x15, 0x02]
        );
    }

    #[test]
    fn rejects_malformed_addresses() {
        assert!(parse_mac("02:15:BF:C6:F0").is_err());
        assert!(parse_mac("02:15:BF:C6:F0:ZZ").is_err());
        assert!(parse_mac("").is_err());
    }
}
