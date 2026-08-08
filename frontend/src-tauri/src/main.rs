// Lexicon desktop shell (Tauri v2).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

struct BackendState {
    child: Mutex<Option<Child>>,
    last_activity: Mutex<Instant>,
    tier1_offloaded: Mutex<bool>,
    tier2_offloaded: Mutex<bool>,
    lifecycle: Mutex<()>,
}

const BACKEND_PORT: u16 = 18000;
const TIER1_LLM_IDLE_SECS: u64 = 5 * 60;       // 5 minutes: unload LLM model weights
const TIER2_LT_IDLE_SECS: u64 = 15 * 60;      // 15 minutes: stop LanguageTool JVM
const TIER3_SIDECAR_IDLE_SECS: u64 = 30 * 60; // 30 minutes: shutdown sidecar
const BACKEND_IDLE_POLL: Duration = Duration::from_secs(15);

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn post_backend_endpoint(endpoint: &str) -> bool {
    let address: SocketAddr = match format!("127.0.0.1:{BACKEND_PORT}").parse() {
        Ok(address) => address,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(500)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let request = format!(
        "POST {endpoint} HTTP/1.1\r\nHost: 127.0.0.1:{BACKEND_PORT}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
    let mut response = Vec::new();
    let _ = stream.read_to_end(&mut response);
    true
}

fn request_backend_shutdown() -> bool {
    post_backend_endpoint("/shutdown")
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

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&sidecar_exe) {
            let mut perms = metadata.permissions();
            if perms.mode() & 0o111 == 0 {
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&sidecar_exe, perms);
            }
        }
    }

    let mut cmd = Command::new(&sidecar_exe);
    // Production uses a dedicated port so a running development backend on
    // 8000 cannot steal the desktop app's requests.
    cmd.env("LEXICON_PORT", BACKEND_PORT.to_string());
    cmd.env("LEXICON_HOST", "127.0.0.1");
    cmd.env("LEXICON_JAVA_HOME", &java_home);
    if !java_home.is_empty() {
        cmd.env("JAVA_HOME", &java_home);
        // language_tool_python finds Java with shutil.which("java") (PATH),
        // not JAVA_HOME. Prepend the bundled JRE bin so Windows installs
        // without a system Java still spawn LanguageTool.
        let java_bin = PathBuf::from(&java_home).join("bin");
        if java_bin.is_dir() {
            let mut paths = env::split_paths(&env::var_os("PATH").unwrap_or_default())
                .collect::<Vec<_>>();
            paths.insert(0, java_bin);
            if let Ok(joined) = env::join_paths(paths) {
                cmd.env("PATH", joined);
            }
        }
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

    #[cfg(target_os = "windows")]
    {
        windows_job::assign_child_to_job(&child);
    }

    if let Err(error) = wait_for_backend(&mut child, BACKEND_PORT) {
        terminate_backend_tree(&mut child);
        return Err(error);
    }
    Ok(child)
}

#[cfg(target_os = "windows")]
mod windows_job {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use std::ptr;

    type HANDLE = *mut std::ffi::c_void;
    type BOOL = i32;
    type DWORD = u32;

    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: DWORD,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: DWORD,
        affinity: usize,
        priority_class: DWORD,
        scheduling_class: DWORD,
    }

    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: DWORD = 0x00002000;
    const JOBOBJECT_EXTENDED_LIMIT_INFORMATION_CLASS: i32 = 9;

    extern "system" {
        fn CreateJobObjectW(job_attributes: *mut std::ffi::c_void, name: *const u16) -> HANDLE;
        fn SetInformationJobObject(
            h_job: HANDLE,
            job_object_information_class: i32,
            lp_job_object_information: *const std::ffi::c_void,
            cb_job_object_information_length: DWORD,
        ) -> BOOL;
        fn AssignProcessToJobObject(h_job: HANDLE, h_process: HANDLE) -> BOOL;
    }

    pub fn assign_child_to_job(child: &Child) {
        unsafe {
            let job = CreateJobObjectW(ptr::null_mut(), ptr::null());
            if job.is_null() {
                return;
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let res = SetInformationJobObject(
                job,
                JOBOBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
            );

            if res != 0 {
                let process_handle = child.as_raw_handle() as HANDLE;
                AssignProcessToJobObject(job, process_handle);
            }
        }
    }
}

fn stop_backend(app_handle: &tauri::AppHandle) {
    if let Some(state) = app_handle.try_state::<BackendState>() {
        let Ok(_lifecycle) = state.lifecycle.lock() else {
            return;
        };
        if let Ok(mut child_lock) = state.child.lock() {
            if let Some(mut child) = child_lock.take() {
                if request_backend_shutdown() {
                    let deadline = Instant::now() + Duration::from_secs(2);
                    while Instant::now() < deadline {
                        if let Ok(Some(_)) = child.try_wait() {
                            break;
                        }
                        thread::sleep(Duration::from_millis(50));
                    }
                }
                // Always terminate the full process tree (including Java/child processes)
                // so no orphan processes or locked DLLs remain.
                terminate_backend_tree(&mut child);
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

    if let Ok(mut t1) = state.tier1_offloaded.lock() {
        *t1 = false;
    }
    if let Ok(mut t2) = state.tier2_offloaded.lock() {
        *t2 = false;
    }

    *state
        .last_activity
        .lock()
        .map_err(|_| "backend activity lock is unavailable".to_string())? = Instant::now();
    Ok(())
}

#[cfg(target_os = "windows")]
fn kill_backend_processes() {
    // Ensure no lingering backend executable processes remain open on Windows
    // and allow Windows kernel time to release file locks on DLLs.
    let _ = Command::new("taskkill")
        .args(["/IM", "lexicon-backend.exe", "/T", "/F"])
        .status();
    thread::sleep(Duration::from_millis(500));
}

#[tauri::command]
fn prepare_for_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    stop_backend(&app_handle);
    #[cfg(target_os = "windows")]
    kill_backend_processes();
    Ok(())
}

// ── Release channels (stable / beta) ──────────────────────────────────
//
// Stable builds check the latest GitHub release's updater manifest; beta
// builds check a manifest published to the gh-pages branch. The frontend
// opts users into the beta channel; stable users never hit the beta URL.

const STABLE_UPDATE_ENDPOINT: &str =
    "https://github.com/AashishH15/Lexicon/releases/latest/download/latest.json";
const BETA_UPDATE_ENDPOINT: &str =
    "https://raw.githubusercontent.com/AashishH15/Lexicon/gh-pages/beta.json";

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started { content_length: Option<u64> },
    #[serde(rename_all = "camelCase")]
    Progress { chunk_length: usize },
    Preparing,
    Installing,
    Finished,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    version: String,
    current_version: String,
    body: String,
}

struct PendingUpdate(Mutex<Option<Update>>);

#[tauri::command]
async fn fetch_update(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
    beta: bool,
) -> Result<Option<UpdateMetadata>, String> {
    let endpoint = if beta {
        BETA_UPDATE_ENDPOINT
    } else {
        STABLE_UPDATE_ENDPOINT
    };
    let update = app
        .updater_builder()
        .endpoints(vec![
            Url::parse(endpoint).map_err(|error| error.to_string())?,
        ])
        .map_err(|error| error.to_string())?
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;

    let metadata = update.as_ref().map(|update| UpdateMetadata {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        body: update.body.clone().unwrap_or_default(),
    });

    *pending
        .0
        .lock()
        .map_err(|_| "update state lock is unavailable".to_string())? = update;
    Ok(metadata)
}

#[tauri::command]
async fn install_update(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
    on_event: Channel<DownloadEvent>,
) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .map_err(|_| "update state lock is unavailable".to_string())?
        .take()
        .ok_or_else(|| "there is no pending update".to_string())?;

    let mut first_chunk = true;
    let bytes = update
        .download(
            |chunk_length, content_length| {
                if first_chunk {
                    let _ = on_event.send(DownloadEvent::Started { content_length });
                    first_chunk = false;
                }
                let _ = on_event.send(DownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(DownloadEvent::Finished);
            },
        )
        .await
        .map_err(|error| error.to_string())?;

    // Windows installers replace the bundled backend/JRE files. Stop the
    // backend explicitly before installing so its DLLs are no longer locked.
    let _ = on_event.send(DownloadEvent::Preparing);
    stop_backend(&app);
    #[cfg(target_os = "windows")]
    kill_backend_processes();

    let _ = on_event.send(DownloadEvent::Installing);
    update.install(bytes).map_err(|error| error.to_string())?;
    Ok(())
}

fn start_idle_monitor(app_handle: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(BACKEND_IDLE_POLL);
        let Some(state) = app_handle.try_state::<BackendState>() else {
            continue;
        };
        let Ok(child) = state.child.lock() else {
            continue;
        };
        if child.is_none() {
            continue;
        }
        let Ok(last_activity) = state.last_activity.lock() else {
            continue;
        };
        let elapsed = last_activity.elapsed();

        if elapsed >= Duration::from_secs(TIER3_SIDECAR_IDLE_SECS) {
            drop(child);
            drop(last_activity);
            stop_backend(&app_handle);
            continue;
        }

        if elapsed >= Duration::from_secs(TIER2_LT_IDLE_SECS) {
            if let Ok(mut t2) = state.tier2_offloaded.lock() {
                if !*t2 {
                    if post_backend_endpoint("/languagetool/unload") {
                        *t2 = true;
                    }
                }
            }
        }

        if elapsed >= Duration::from_secs(TIER1_LLM_IDLE_SECS) {
            if let Ok(mut t1) = state.tier1_offloaded.lock() {
                if !*t1 {
                    if post_backend_endpoint("/ai/unload") {
                        *t1 = true;
                    }
                }
            }
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
                let _ = window.eval("window.dispatchEvent(new Event('resize'));");
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.manage(BackendState {
                child: Mutex::new(None),
                last_activity: Mutex::new(Instant::now()),
                tier1_offloaded: Mutex::new(false),
                tier2_offloaded: Mutex::new(false),
                lifecycle: Mutex::new(()),
            });
            app.manage(PendingUpdate(Mutex::new(None)));
            let handle_clone = app.handle().clone();
            thread::spawn(move || {
                if let Some(state) = handle_clone.try_state::<BackendState>() {
                    let Ok(_lifecycle) = state.lifecycle.lock() else {
                        return;
                    };
                    if let Ok(mut child_lock) = state.child.lock() {
                        if child_lock.is_none() {
                            match start_backend(&handle_clone) {
                                Ok(child) => *child_lock = Some(child),
                                Err(error) => {
                                    eprintln!("Warning: initial backend sidecar start failed: {error}");
                                }
                            }
                        }
                    }
                }
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
                            let _ = window.eval("window.dispatchEvent(new Event('resize'));");
                        }
                    }
                    "quit" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                        stop_backend(app);
                        app.exit(0);
                    }
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
                            let _ = window.eval("window.dispatchEvent(new Event('resize'));");
                        }
                    }
                });
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ensure_backend,
            prepare_for_update,
            fetch_update,
            install_update
        ])
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
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
                stop_backend(app_handle);
            }
            _ => {}
        });
}
