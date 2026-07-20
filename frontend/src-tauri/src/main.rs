// Lexicon desktop shell (Tauri v2).

use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");

            // Bundled JRE (resources/jre) so LanguageTool needs no Java install.
            let jre_dir = resource_dir.join("jre");
            let java_home = if jre_dir.is_dir() {
                jre_dir.to_string_lossy().to_string()
            } else {
                String::new()
            };

            // Onedir sidecar: resources/lexicon-backend/lexicon-backend[.exe]
            // (the `_internal` folder sits beside it and is required at runtime).
            // PyInstaller adds `.exe` only on Windows; the macOS bundle uses
            // the extensionless executable name.
            let sidecar_name = if cfg!(target_os = "windows") {
                "lexicon-backend.exe"
            } else {
                "lexicon-backend"
            };
            let sidecar_exe: PathBuf = resource_dir.join("lexicon-backend").join(sidecar_name);

            let mut cmd = Command::new(&sidecar_exe);
            // The frontend talks to localhost:8000; pin it so the sidecar
            // always matches regardless of the user's environment.
            cmd.env("LEXICON_PORT", "8000");
            cmd.env("LEXICON_JAVA_HOME", &java_home);
            if !java_home.is_empty() {
                cmd.env("JAVA_HOME", &java_home);
            }

            let child = cmd
                .spawn()
                .map_err(|e| format!("failed to spawn backend sidecar {:?}: {e}", sidecar_exe))?;

            // Keep the child alive for the app's lifetime (Tauri drops it on exit).
            std::mem::forget(child);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Lexicon");
}
