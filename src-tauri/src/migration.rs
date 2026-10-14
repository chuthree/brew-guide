//! One-time migration IO. Normal repositories remain in storage.rs/TypeScript.
use std::{fs, io::Write, path::Path};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

fn write_verified(path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid backup path")?;
    let temp = parent.join(format!(
        ".brew-guide-save-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?.as_nanos()
    ));
    let result = (|| {
        let mut file = fs::OpenOptions::new().write(true).create_new(true)
            .open(&temp).map_err(|e| e.to_string())?;
        file.write_all(data).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        fs::rename(&temp, path).map_err(|e| e.to_string())?;
        if fs::read(path).map_err(|e| e.to_string())? != data {
            return Err("Backup read-back verification failed".into());
        }
        Ok(())
    })();
    if temp.exists() { let _ = fs::remove_file(temp); }
    result
}

#[tauri::command]
pub async fn migration_save_backup(app: tauri::AppHandle, data: String, file_name: String) -> Result<bool, String> {
    let Some(path) = app.dialog().file().set_file_name(file_name)
        .add_filter("JSON backup", &["json"]).blocking_save_file() else { return Ok(false); };
    let path = path.into_path().map_err(|e| e.to_string())?;
    write_verified(&path, data.as_bytes())?;
    Ok(true)
}

#[tauri::command]
pub async fn migration_cleanup_approval(app: tauri::AppHandle, operation: String, value: Option<String>) -> Result<Option<String>, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = root.join("legacy-cleanup-approval.txt");
    match operation.as_str() {
        "get" => match fs::read_to_string(path) {
            Ok(value) => Ok(Some(value)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        },
        "set" => {
            let value = value.ok_or("Missing approval digest")?;
            if value.len() != 64 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err("Invalid approval digest".into());
            }
            fs::create_dir_all(&root).map_err(|e| e.to_string())?;
            write_verified(&path, value.as_bytes())?;
            Ok(None)
        },
        "remove" => {
            match fs::remove_file(path) {
                Ok(()) => {},
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {},
                Err(e) => return Err(e.to_string()),
            }
            Ok(None)
        },
        _ => Err("Unknown migration approval operation".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_write_is_complete_and_readable_before_success() {
        let root = std::env::temp_dir().join(format!("brew-guide-backup-test-{}",std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("backup.json");
        write_verified(&path, br#"{"data":{"coffeeBeans":[{"id":"bean"}]}}"#).unwrap();
        assert_eq!(fs::read(&path).unwrap(), br#"{"data":{"coffeeBeans":[{"id":"bean"}]}}"#);
        assert!(write_verified(&root.join("missing/backup.json"), b"backup").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
