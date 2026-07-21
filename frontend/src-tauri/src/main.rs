// Lexicon desktop shell (Tauri v2).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, WindowEvent};

struct BackendState {
    child: Mutex<Option<Child>>,
    last_activity: Mutex<Instant>,
    lifecycle: Mutex<()>,
}

const BACKEND_PORT: u16 = 18000;
const BACKEND_IDLE_AFTER: Duration = Duration::from_secs(20 * 60);
const BACKEND_IDLE_POLL: Duration = Duration::from_secs(30);

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn request_backend_shutdown() -> bool {
    let address: SocketAddr = match format!("127.0.0.1:{BACKEND_PORT}").parse() {
        Ok(address) => address,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(500)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let request = format!(
        "POST /shutdown HTTP/1.1\r\nHost: 127.0.0.1:{BACKEND_PORT}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut response = Vec::new();
    let _ = stream.read_to_end(&mut response);
    true
}

fn terminate_backend_tree(child: &mut Child) {
    #[cfg(target_os = "windows")]
    {
        let pid = child.id().to_string();
        let _ = Command::new("taskkill")
            .args(["/PID", pid.as_str(), "/T", "/F"])
            .status();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = child.kill();
    }
    let _ = child.wait();
}

fn start_backend(app_handle: &tauri::AppHandle) -> Result<Child, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve resource dir: {error}"))?;

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
    // Production uses a dedicated port so a running development backend on
    // 8000 cannot steal the desktop app's requests.
    cmd.env("LEXICON_PORT", BACKEND_PORT.to_string());
    cmd.env("LEXICON_HOST", "127.0.0.1");
    cmd.env("LEXICON_JAVA_HOME", &java_home);
    if !java_home.is_empty() {
        cmd.env("JAVA_HOME", &java_home);
    }
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|error| format!("failed to spawn backend sidecar {:?}: {error}", sidecar_exe))?;

    if let Err(error) = wait_for_backend(&mut child, BACKEND_PORT) {
        terminate_backend_tree(&mut child);
        return Err(error);
    }
    Ok(child)
}

fn stop_backend(app_handle: &tauri::AppHandle) {
    if let Some(state) = app_handle.try_state::<BackendState>() {
        let Ok(_lifecycle) = state.lifecycle.lock() else {
            return;
        };
        if let Ok(mut child) = state.child.lock() {
            if let Some(mut child) = child.take() {
                if !request_backend_shutdown() {
                    terminate_backend_tree(&mut child);
                    return;
                }
                let deadline = Instant::now() + Duration::from_secs(5);
                loop {
                    match child.try_wait() {
                        Ok(Some(_)) => break,
                        Ok(None) if Instant::now() < deadline => {
                            thread::sleep(Duration::from_millis(50));
                        }
                        _ => {
                            terminate_backend_tree(&mut child);
                            break;
                        }
                    }
                }
            }
        }
    }
}

fn wait_for_backend(child: &mut Child, port: u16) -> Result<(), String> {
    let address: SocketAddr = format!("127.0.0.1:{port}")
        .parse()
        .map_err(|error| format!("invalid backend address: {error}"))?;
    let deadline = Instant::now() + Duration::from_secs(20);

    while Instant::now() < deadline {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("failed to inspect backend sidecar: {error}"))?
        {
            return Err(format!(
                "backend sidecar exited before becoming ready: {status}"
            ));
        }
        if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }

    Err(format!(
        "backend sidecar did not become ready on 127.0.0.1:{port}"
    ))
}

#[tauri::command]
fn ensure_backend(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<BackendState>();
    let _lifecycle = state
        .lifecycle
        .lock()
        .map_err(|_| "backend lifecycle lock is unavailable".to_string())?;
    let mut child = state
        .child
        .lock()
        .map_err(|_| "backend process lock is unavailable".to_string())?;

    let mut needs_start = child.is_none();
    if let Some(process) = child.as_mut() {
        match process.try_wait() {
            Ok(None) => {}
            Ok(Some(_)) | Err(_) => needs_start = true,
        }
    }

    if needs_start {
        if let Some(mut old_child) = child.take() {
            terminate_backend_tree(&mut old_child);
        }
        *child = Some(start_backend(&app_handle)?);
    }

    *state
        .last_activity
        .lock()
        .map_err(|_| "backend activity lock is unavailable".to_string())? = Instant::now();
    Ok(())
}

fn backend_is_idle(app_handle: &tauri::AppHandle) -> bool {
    let Some(state) = app_handle.try_state::<BackendState>() else {
        return false;
    };
    let Ok(child) = state.child.lock() else {
        return false;
    };
    let Ok(last_activity) = state.last_activity.lock() else {
        return false;
    };
    child.is_some() && last_activity.elapsed() >= BACKEND_IDLE_AFTER
}

fn start_idle_monitor(app_handle: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(BACKEND_IDLE_POLL);
        if backend_is_idle(&app_handle) {
            stop_backend(&app_handle);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        // Keep repeated launches from creating duplicate windows. The plugin
        // must be registered before the other plugins so the second process
        // exits before starting the backend or any other app resources.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let child = start_backend(app.handle())?;
            app.manage(BackendState {
                child: Mutex::new(Some(child)),
                last_activity: Mutex::new(Instant::now()),
                lifecycle: Mutex::new(()),
            });
            start_idle_monitor(app.handle().clone());

            let open_item = MenuItemBuilder::with_id("open", "Open Lexicon").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit Lexicon").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&open_item, &quit_item])
                .build()?;

            let mut tray = TrayIconBuilder::with_id("lexicon-tray")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("Lexicon")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ensure_backend])
        .build(tauri::generate_context!())
        .expect("error while building Lexicon")
        .run(|app_handle, event| match event {
            RunEvent::WindowEvent {
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } => {
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                stop_backend(app_handle);
            }
            _ => {}
        });
}
