use std::{net::{TcpStream, SocketAddr}, io::{Read, Write}, process::{Child, Command}, time::Duration};

pub struct ImageService(Option<Child>);

fn healthy() -> bool {
    let address: SocketAddr = "127.0.0.1:8765".parse().unwrap();
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(300)) else { return false; };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
    if stream.write_all(b"GET /health HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n").is_err() { return false; }
    let mut response = String::new();
    stream.read_to_string(&mut response).is_ok()
        && response.starts_with("HTTP/1.1 200") && response.contains("\"status\":\"ok\"")
}

impl ImageService {
    pub fn start() -> Result<Self, Box<dyn std::error::Error>> {
        if healthy() { return Ok(Self(None)); }
        // Allow installed apps to use a separately prepared local runtime.
        let root = std::env::var_os("WALKFIT_IMAGE_ROOT").map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf());
        let python = root.join(if cfg!(windows) { ".venv-images/Scripts/python.exe" } else { ".venv-images/bin/python" });
        let mut command = Command::new(python);
        command.current_dir(&root).args(["-m", "uvicorn", "app:app", "--app-dir", "image-service", "--host", "127.0.0.1", "--port", "8765"]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let mut service = Self(Some(command.spawn().map_err(|error| format!("이미지 서버 실행 실패: {error}. image-service/README.md의 최초 준비를 확인하세요."))?));
        for _ in 0..60 {
            if let Some(child) = service.0.as_mut() {
                if let Some(status) = child.try_wait()? { return Err(format!("이미지 서버가 종료되었습니다: {status}").into()); }
            }
            if healthy() { return Ok(service); }
            std::thread::sleep(Duration::from_millis(500));
        }
        Err("이미지 서버 시작 시간이 초과되었습니다.".into())
    }
}

impl Drop for ImageService {
    fn drop(&mut self) {
        if let Some(child) = self.0.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
