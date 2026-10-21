mod image_service;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut image_service = Some(image_service::ImageService::start()
    .expect("이미지 처리 서버를 시작할 수 없습니다"));
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(move |_app, event| {
      if matches!(event, tauri::RunEvent::Exit) {
        drop(image_service.take());
      }
    });
}
