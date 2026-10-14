//! Platform IO only. Schema, migrations and business repositories live in TypeScript.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::{fs, io::Write, path::Path, sync::Mutex};
use tauri::Manager;

#[derive(Default)]
pub struct Storage(pub Mutex<Option<Connection>>);

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "camelCase")]
pub enum SqliteRequest {
    Open,
    Close,
    Execute { sql: String, params: Vec<Value> },
    Query { sql: String, params: Vec<Value> },
    Begin,
    Commit,
    Rollback,
    Active,
}

fn sql_params(params: Vec<Value>) -> Result<Vec<SqlValue>, String> {
    params
        .into_iter()
        .map(|value| match value {
            Value::Null => Ok(SqlValue::Null),
            Value::String(text) => Ok(SqlValue::Text(text)),
            Value::Number(number) => {
                if let Some(integer) = number.as_i64() {
                    if integer.unsigned_abs() > 9_007_199_254_740_991 {
                        return Err("Unsafe SQL integer".into());
                    }
                    Ok(SqlValue::Integer(integer))
                } else {
                    let real = number.as_f64().ok_or("Invalid SQL number")?;
                    if !real.is_finite()
                        || (real.fract() == 0.0 && real.abs() > 9_007_199_254_740_991.0)
                    {
                        return Err("Unsafe SQL number".into());
                    }
                    Ok(SqlValue::Real(real))
                }
            }
            _ => Err("SQL values must be string, number or null".into()),
        })
        .collect()
}

fn sqlite_request(
    slot: &mut Option<Connection>,
    root: &Path,
    request: SqliteRequest,
) -> Result<Value, String> {
    if matches!(request, SqliteRequest::Open) {
        if let Some(connection) = slot.as_ref() {
            // A WebView reload must never inherit a half-finished transaction.
            if !connection.is_autocommit() {
                connection
                    .execute_batch("ROLLBACK")
                    .map_err(|error| error.to_string())?;
            }
        } else {
            fs::create_dir_all(root).map_err(|error| error.to_string())?;
            *slot = Some(
                Connection::open(root.join("brew-guide.sqlite3"))
                    .map_err(|error| error.to_string())?,
            );
        }
        return Ok(Value::Null);
    }
    if matches!(request, SqliteRequest::Close) {
        if let Some(connection) = slot.take() {
            if let Err((connection, error)) = connection.close() {
                *slot = Some(connection);
                return Err(error.to_string());
            }
        }
        return Ok(Value::Null);
    }
    let connection = slot.as_ref().ok_or("Desktop SQLite is not open")?;
    let changes = match request {
        SqliteRequest::Execute { sql, params } => {
            let params = sql_params(params)?;
            connection
                .execute(&sql, params_from_iter(params))
                .map_err(|error| error.to_string())?
        }
        SqliteRequest::Query { sql, params } => {
            let params = sql_params(params)?;
            let mut statement = connection
                .prepare(&sql)
                .map_err(|error| error.to_string())?;
            let names: Vec<String> = statement
                .column_names()
                .iter()
                .map(|name| (*name).into())
                .collect();
            let mut rows = statement
                .query(params_from_iter(params))
                .map_err(|error| error.to_string())?;
            let mut values = Vec::new();
            while let Some(row) = rows.next().map_err(|error| error.to_string())? {
                let mut value = Map::new();
                for (index, name) in names.iter().enumerate() {
                    let cell: SqlValue = row.get(index).map_err(|error| error.to_string())?;
                    let cell = match cell {
                        SqlValue::Null => Value::Null,
                        SqlValue::Text(text) => Value::String(text),
                        SqlValue::Integer(integer)
                            if integer.unsigned_abs() <= 9_007_199_254_740_991 =>
                        {
                            json!(integer)
                        }
                        SqlValue::Real(real)
                            if real.is_finite()
                                && (real.fract() != 0.0
                                    || real.abs() <= 9_007_199_254_740_991.0) =>
                        {
                            json!(real)
                        }
                        _ => return Err("Unsupported or unsafe SQLite result".into()),
                    };
                    value.insert(name.clone(), cell);
                }
                values.push(value);
            }
            return Ok(json!({ "values": values }));
        }
        SqliteRequest::Active => return Ok(json!(!connection.is_autocommit())),
        SqliteRequest::Begin | SqliteRequest::Commit | SqliteRequest::Rollback => {
            let sql = match request {
                SqliteRequest::Begin => "BEGIN IMMEDIATE",
                SqliteRequest::Commit => "COMMIT",
                _ => "ROLLBACK",
            };
            connection
                .execute_batch(sql)
                .map_err(|error| error.to_string())?;
            0
        }
        _ => unreachable!(),
    };
    Ok(json!({ "changes": { "changes": changes } }))
}

#[tauri::command]
pub async fn storage_sqlite(
    app: tauri::AppHandle,
    state: tauri::State<'_, Storage>,
    request: SqliteRequest,
) -> Result<Value, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let mut slot = state.0.lock().map_err(|_| "Desktop SQLite lock poisoned")?;
    sqlite_request(&mut slot, &root, request)
}

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "camelCase")]
pub enum ImageRequest {
    Write {
        #[serde(rename = "objectKey")]
        object_key: String,
        data: String,
    },
    Read {
        #[serde(rename = "objectKey")]
        object_key: String,
    },
    Delete {
        #[serde(rename = "objectKey")]
        object_key: String,
    },
    Exists {
        #[serde(rename = "objectKey")]
        object_key: String,
    },
    List,
}

fn validate_key(key: &str) -> Result<(), String> {
    if key.is_empty()
        || key.len() > 128
        || !key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err("Invalid image object key".into());
    }
    Ok(())
}

fn image_request(root: &Path, request: ImageRequest) -> Result<Value, String> {
    let root = root.join("images/v1/objects");
    if matches!(request, ImageRequest::List) {
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(json!([])),
            Err(error) => return Err(error.to_string()),
        };
        let mut keys = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|error| error.to_string())?;
            if !entry
                .file_type()
                .map_err(|error| error.to_string())?
                .is_file()
            {
                return Err("Unexpected image directory entry".into());
            }
            let key = entry
                .file_name()
                .into_string()
                .map_err(|_| "Invalid image filename")?;
            validate_key(&key)?;
            keys.push(key);
        }
        keys.sort();
        return Ok(json!(keys));
    }
    let key = match &request {
        ImageRequest::Write { object_key, .. }
        | ImageRequest::Read { object_key }
        | ImageRequest::Delete { object_key }
        | ImageRequest::Exists { object_key } => object_key,
        _ => unreachable!(),
    };
    validate_key(key)?;
    let path = root.join(key);
    // Reject links and directories rather than following them outside the object root.
    match fs::symlink_metadata(&path) {
        Ok(metadata) if !metadata.file_type().is_file() => {
            return Err("Unexpected image object type".into())
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    match request {
        ImageRequest::Write { data, .. } => {
            let bytes = STANDARD.decode(data).map_err(|error| error.to_string())?;
            fs::create_dir_all(&root).map_err(|error| error.to_string())?;
            // Exclusive creation preserves existing objects, including concurrent writes.
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|error| error.to_string())?;
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(|error| error.to_string())?;
            if fs::read(&path).map_err(|error| error.to_string())? != bytes {
                return Err("Image write read-back mismatch".into());
            }
            #[cfg(unix)]
            fs::File::open(&root)
                .and_then(|directory| directory.sync_all())
                .map_err(|error| error.to_string())?;
            Ok(Value::Null)
        }
        ImageRequest::Read { .. } => Ok(json!(fs::read(path).map_err(|error| error.to_string())?)),
        ImageRequest::Delete { .. } => {
            match fs::remove_file(path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.to_string()),
            }
            Ok(Value::Null)
        }
        ImageRequest::Exists { .. } => match fs::metadata(path) {
            Ok(_) => Ok(json!(true)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(json!(false)),
            Err(error) => Err(error.to_string()),
        },
        _ => unreachable!(),
    }
}

#[tauri::command]
pub async fn storage_image(app: tauri::AppHandle, request: ImageRequest) -> Result<Value, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    image_request(&root, request)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(std::path::PathBuf);
    impl TestDirectory {
        fn new() -> Self {
            static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let base = std::env::temp_dir();
            let root = loop {
                let candidate = base.join(format!(
                    "brew-guide-storage-{}-{}-{}",
                    std::process::id(),
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_nanos(),
                    NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
                ));
                match fs::create_dir(&candidate) {
                    Ok(()) => break candidate,
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("could not create SQLite test directory: {error}"),
                }
            };
            Self(root)
        }
    }
    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn sql(slot: &mut Option<Connection>, root: &Path, request: Value) -> Result<Value, String> {
        sqlite_request(slot, root, serde_json::from_value(request).unwrap())
    }
    fn image(root: &Path, request: Value) -> Result<Value, String> {
        image_request(root, serde_json::from_value(request).unwrap())
    }

    #[test]
    fn sqlite_binding_transactions_and_reopen_preserve_durable_rows() {
        let root = TestDirectory::new();
        let mut slot = None;
        sql(&mut slot, &root.0, json!({"operation":"open"})).unwrap();
        sql(&mut slot, &root.0, json!({"operation":"execute", "sql":"CREATE TABLE records (id TEXT PRIMARY KEY, value INTEGER, extra TEXT)", "params":[]})).unwrap();
        let insert = json!({"operation":"execute", "sql":"INSERT INTO records VALUES (?, ?, ?)", "params":["引号 ' ? ;", 123, null]});
        sql(&mut slot, &root.0, json!({"operation":"begin"})).unwrap();
        assert_eq!(
            sql(&mut slot, &root.0, insert.clone()).unwrap()["changes"]["changes"],
            1
        );
        sql(&mut slot, &root.0, json!({"operation":"commit"})).unwrap();
        sql(&mut slot, &root.0, json!({"operation":"begin"})).unwrap();
        assert!(sql(&mut slot, &root.0, insert).is_err());
        sql(
            &mut slot,
            &root.0,
            json!({"operation":"execute", "sql":"DELETE FROM records", "params":[]}),
        )
        .unwrap();
        sql(&mut slot, &root.0, json!({"operation":"rollback"})).unwrap();
        // Simulate WebView reload while a transaction is still open.
        sql(&mut slot, &root.0, json!({"operation":"begin"})).unwrap();
        sql(
            &mut slot,
            &root.0,
            json!({"operation":"execute", "sql":"DELETE FROM records", "params":[]}),
        )
        .unwrap();
        sql(&mut slot, &root.0, json!({"operation":"open"})).unwrap();
        assert_eq!(
            sql(&mut slot, &root.0, json!({"operation":"active"})).unwrap(),
            false
        );
        sql(&mut slot, &root.0, json!({"operation":"close"})).unwrap();
        sql(&mut slot, &root.0, json!({"operation":"open"})).unwrap();
        assert_eq!(
            sql(
                &mut slot,
                &root.0,
                json!({"operation":"query", "sql":"SELECT * FROM records", "params":[]})
            )
            .unwrap(),
            json!({"values":[{"id":"引号 ' ? ;", "value":123, "extra":null}]})
        );
        assert!(sql(&mut slot, &root.0, json!({"operation":"query", "sql":"SELECT 9007199254740992 AS unsafe_value", "params":[]})).is_err());
        assert!(sql_params(vec![json!(true)]).is_err());
        assert!(sql_params(vec![json!(9_007_199_254_740_992_i64)]).is_err());
    }

    #[test]
    fn sqlite_supports_schema_bootstrap_pragmas() {
        let root = TestDirectory::new();
        let mut slot = None;
        sql(&mut slot, &root.0, json!({"operation":"open"})).unwrap();
        let journal = sql(
            &mut slot,
            &root.0,
            json!({"operation":"query", "sql":"PRAGMA journal_mode = DELETE", "params":[]}),
        )
        .unwrap();
        assert_eq!(journal["values"][0]["journal_mode"], "delete");
        for pragma in [
            "PRAGMA synchronous = FULL",
            "PRAGMA foreign_keys = ON",
            "PRAGMA user_version = 1",
        ] {
            sql(
                &mut slot,
                &root.0,
                json!({"operation":"execute", "sql":pragma, "params":[]}),
            )
            .unwrap();
        }
        assert_eq!(
            sql(
                &mut slot,
                &root.0,
                json!({"operation":"query", "sql":"PRAGMA user_version", "params":[]})
            )
            .unwrap()["values"][0]["user_version"],
            1
        );
    }

    #[test]
    fn image_objects_are_immutable_private_and_survive_reopen() {
        let root = TestDirectory::new();
        assert_eq!(
            image(&root.0, json!({"operation":"list"})).unwrap(),
            json!([])
        );
        let write = json!({"operation":"write", "objectKey":"migration_1", "data":"AP+AAQ=="});
        image(&root.0, write.clone()).unwrap();
        assert!(image(&root.0, write).is_err());
        assert_eq!(
            image(
                &root.0,
                json!({"operation":"read", "objectKey":"migration_1"})
            )
            .unwrap(),
            json!([0, 255, 128, 1])
        );
        assert_eq!(
            image(&root.0, json!({"operation":"list"})).unwrap(),
            json!(["migration_1"])
        );
        for operation in ["read", "exists", "delete", "write"] {
            assert!(image(
                &root.0,
                json!({"operation":operation, "objectKey":"../outside", "data":""})
            )
            .is_err());
        }
        image(
            &root.0,
            json!({"operation":"delete", "objectKey":"migration_1"}),
        )
        .unwrap();
        image(
            &root.0,
            json!({"operation":"delete", "objectKey":"migration_1"}),
        )
        .unwrap();
        assert_eq!(
            image(
                &root.0,
                json!({"operation":"exists", "objectKey":"migration_1"})
            )
            .unwrap(),
            false
        );
        fs::create_dir(root.0.join("images/v1/objects/nested")).unwrap();
        assert!(image(&root.0, json!({"operation":"list"})).is_err());
    }
}
