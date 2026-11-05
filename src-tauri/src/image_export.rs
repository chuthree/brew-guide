use base64::{engine::general_purpose::STANDARD, Engine};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn save_image(
    app: tauri::AppHandle,
    data_url: String,
    file_name: String,
) -> Result<bool, String> {
    let (header, payload) = data_url.split_once(',').ok_or("Invalid image data URL")?;
    let extension = match header {
        "data:image/png;base64" => "png",
        "data:image/jpeg;base64" => "jpeg",
        "data:image/webp;base64" => "webp",
        "data:image/gif;base64" => "gif",
        _ => return Err("Unsupported image format".into()),
    };
    let bytes = STANDARD.decode(payload).map_err(|error| error.to_string())?;
    if bytes.is_empty() {
        return Err("Image data is empty".into());
    }
    let file_name = file_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "-");
    let Some(path) = app.dialog().file().set_file_name(file_name)
        .add_filter("Image", &[extension]).blocking_save_file() else { return Ok(false); };
    let path = path.into_path().map_err(|error| error.to_string())?;
    crate::migration::write_verified(&path, &bytes)?;
    Ok(true)
}
