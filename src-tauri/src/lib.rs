
#[tauri::command]
fn open_link(url: String) {
  // Native command to open links in default browser
  #[cfg(not(mobile))]
  {
    // Use the native shell opener provided by Tauri or a crate like `opener`
    // For this environment, we assume the `webbrowser` or similar crate is available 
    // as configured in the project's boilerplate.
    let _ = webbrowser::open(&url);
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_link])
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
