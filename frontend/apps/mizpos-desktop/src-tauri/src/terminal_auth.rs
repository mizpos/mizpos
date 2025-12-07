//! 端末認証モジュール
//!
//! Ed25519キーペアを生成し、OS Keychainに保存、署名を生成する
//! Keychainが使えない場合はファイルベースのフォールバックを使用

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Keychainのサービス名
const KEYCHAIN_SERVICE: &str = "com.miz.mizpos";
/// 秘密鍵のアカウント名
const KEYCHAIN_ACCOUNT_PRIVATE_KEY: &str = "terminal-private-key";
/// 端末IDのアカウント名
const KEYCHAIN_ACCOUNT_TERMINAL_ID: &str = "terminal-id";
/// フォールバック用ファイル名
const FALLBACK_CREDENTIALS_FILE: &str = "terminal_credentials.json";

/// フォールバック用の認証情報
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FallbackCredentials {
    terminal_id: String,
    private_key: String, // Base64
}

/// フォールバック用のファイルパスを取得
#[cfg(not(target_os = "android"))]
fn get_fallback_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|p| p.join("com.miz.mizpos").join(FALLBACK_CREDENTIALS_FILE))
}

/// フォールバックから認証情報を読み込む
#[cfg(not(target_os = "android"))]
fn load_from_fallback() -> Option<FallbackCredentials> {
    let path = get_fallback_path()?;
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

/// フォールバックに認証情報を保存
#[cfg(not(target_os = "android"))]
fn save_to_fallback(creds: &FallbackCredentials) -> Result<(), TerminalAuthError> {
    let path = get_fallback_path()
        .ok_or_else(|| TerminalAuthError::KeychainError("Cannot determine data directory".to_string()))?;

    // ディレクトリを作成
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| TerminalAuthError::KeychainError(format!("Failed to create directory: {}", e)))?;
    }

    let content = serde_json::to_string(creds)
        .map_err(|e| TerminalAuthError::KeychainError(format!("Failed to serialize: {}", e)))?;

    fs::write(&path, content)
        .map_err(|e| TerminalAuthError::KeychainError(format!("Failed to write file: {}", e)))?;

    Ok(())
}

/// フォールバックファイルを削除
#[cfg(not(target_os = "android"))]
fn clear_fallback() {
    if let Some(path) = get_fallback_path() {
        let _ = fs::remove_file(path);
    }
}

/// 端末の状態
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TerminalStatus {
    /// 未登録（キーペア未生成）
    Uninitialized,
    /// キーペア生成済み、サーバー登録待ち
    PendingRegistration,
    /// 登録済み
    Registered,
    /// 無効化済み
    Revoked,
}

/// QRコード用のペイロード
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationQrPayload {
    /// バージョン
    pub v: u8,
    /// 端末ID (UUID)
    pub terminal_id: String,
    /// Base64エンコードされた公開鍵
    pub public_key: String,
    /// 端末名
    pub device_name: String,
    /// OS種別
    pub os: String,
    /// 生成日時 (ISO8601)
    pub created_at: String,
}

/// 端末認証の結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalAuthResult {
    pub status: String,
    pub terminal_id: Option<String>,
    pub public_key: Option<String>,
    pub error: Option<String>,
}

/// 署名リクエスト用のデータ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureData {
    pub terminal_id: String,
    pub timestamp: u64,
    pub signature: String,
}

/// エラー型
#[derive(Debug)]
pub enum TerminalAuthError {
    KeychainError(String),
    CryptoError(String),
    NotInitialized,
    InvalidKey,
}

impl std::fmt::Display for TerminalAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::KeychainError(msg) => write!(f, "Keychain error: {}", msg),
            Self::CryptoError(msg) => write!(f, "Crypto error: {}", msg),
            Self::NotInitialized => write!(f, "Terminal not initialized"),
            Self::InvalidKey => write!(f, "Invalid key"),
        }
    }
}

impl std::error::Error for TerminalAuthError {}

/// 秘密鍵をBase64から復元
#[cfg(not(target_os = "android"))]
fn decode_private_key(base64_key: &str) -> Result<SigningKey, TerminalAuthError> {
    let key_bytes = BASE64
        .decode(base64_key)
        .map_err(|e| TerminalAuthError::CryptoError(e.to_string()))?;

    if key_bytes.len() != 32 {
        return Err(TerminalAuthError::InvalidKey);
    }

    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| TerminalAuthError::InvalidKey)?;

    Ok(SigningKey::from_bytes(&key_array))
}

/// Keychainから秘密鍵を読み込む（フォールバック付き）
#[cfg(not(target_os = "android"))]
fn load_private_key_from_keychain() -> Result<Option<SigningKey>, TerminalAuthError> {
    // まずKeychainを試す
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PRIVATE_KEY) {
        match entry.get_password() {
            Ok(base64_key) => {
                return Ok(Some(decode_private_key(&base64_key)?));
            }
            Err(keyring::Error::NoEntry) => {
                // Keychainにエントリがない場合はフォールバックを確認
            }
            Err(_) => {
                // Keychainエラーの場合もフォールバックを確認
            }
        }
    }

    // フォールバックから読み込む
    if let Some(creds) = load_from_fallback() {
        return Ok(Some(decode_private_key(&creds.private_key)?));
    }

    Ok(None)
}

/// Keychainに秘密鍵を保存（フォールバック付き）
/// terminal_idも一緒に渡してフォールバック保存に使用
#[cfg(not(target_os = "android"))]
fn save_private_key_to_keychain(signing_key: &SigningKey, terminal_id: &str) -> Result<(), TerminalAuthError> {
    let base64_key = BASE64.encode(signing_key.to_bytes());

    // Keychainへの保存を試みる（失敗しても続行）
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PRIVATE_KEY) {
        let _ = entry.set_password(&base64_key);
    }

    // フォールバックにも保存（Keychainが失敗しても確実に保存）
    let creds = FallbackCredentials {
        terminal_id: terminal_id.to_string(),
        private_key: base64_key,
    };
    save_to_fallback(&creds)?;

    Ok(())
}

/// Keychainから端末IDを読み込む（フォールバック付き）
#[cfg(not(target_os = "android"))]
fn load_terminal_id_from_keychain() -> Result<Option<String>, TerminalAuthError> {
    // まずKeychainを試す
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_TERMINAL_ID) {
        match entry.get_password() {
            Ok(terminal_id) => {
                return Ok(Some(terminal_id));
            }
            Err(keyring::Error::NoEntry) => {
                // Keychainにエントリがない場合はフォールバックを確認
            }
            Err(_) => {
                // Keychainエラーの場合もフォールバックを確認
            }
        }
    }

    // フォールバックから読み込む
    if let Some(creds) = load_from_fallback() {
        return Ok(Some(creds.terminal_id));
    }

    Ok(None)
}

/// Keychainに端末IDを保存（フォールバック付き）
#[cfg(not(target_os = "android"))]
fn save_terminal_id_to_keychain(terminal_id: &str) -> Result<(), TerminalAuthError> {
    // Keychainへの保存を試みる（失敗しても続行）
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_TERMINAL_ID) {
        let _ = entry.set_password(terminal_id);
    }
    // フォールバックは save_private_key_to_keychain で一緒に保存される
    Ok(())
}

/// Keychainから認証情報を削除（フォールバック含む）
#[cfg(not(target_os = "android"))]
pub fn clear_keychain() -> Result<(), TerminalAuthError> {
    // Keychainから秘密鍵を削除
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_PRIVATE_KEY) {
        let _ = entry.delete_credential();
    }

    // Keychainから端末IDを削除
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_TERMINAL_ID) {
        let _ = entry.delete_credential();
    }

    // フォールバックファイルも削除
    clear_fallback();

    Ok(())
}

/// 端末の状態を取得
#[cfg(not(target_os = "android"))]
pub fn get_terminal_status() -> Result<TerminalAuthResult, TerminalAuthError> {
    let terminal_id = load_terminal_id_from_keychain()?;
    let private_key = load_private_key_from_keychain()?;

    match (terminal_id, private_key) {
        (Some(id), Some(key)) => {
            let public_key = key.verifying_key();
            let public_key_base64 = BASE64.encode(public_key.to_bytes());

            Ok(TerminalAuthResult {
                status: "initialized".to_string(),
                terminal_id: Some(id),
                public_key: Some(public_key_base64),
                error: None,
            })
        }
        (None, None) => Ok(TerminalAuthResult {
            status: "uninitialized".to_string(),
            terminal_id: None,
            public_key: None,
            error: None,
        }),
        _ => {
            // 不整合な状態（片方だけある）- クリアして再初期化
            clear_keychain()?;
            Ok(TerminalAuthResult {
                status: "uninitialized".to_string(),
                terminal_id: None,
                public_key: None,
                error: Some("Inconsistent state, cleared".to_string()),
            })
        }
    }
}

/// 新しいキーペアを生成して保存
#[cfg(not(target_os = "android"))]
pub fn initialize_terminal(device_name: &str) -> Result<RegistrationQrPayload, TerminalAuthError> {
    // 既存のキーがあればエラー
    if load_private_key_from_keychain()?.is_some() {
        return Err(TerminalAuthError::KeychainError(
            "Terminal already initialized".to_string(),
        ));
    }

    // 新しいキーペアを生成
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();

    // 端末IDを生成
    let terminal_id = Uuid::new_v4().to_string();

    // Keychainに保存（フォールバックにも同時に保存される）
    save_private_key_to_keychain(&signing_key, &terminal_id)?;
    save_terminal_id_to_keychain(&terminal_id)?;

    // 現在時刻を取得
    let now = chrono_now_iso8601();

    // OS種別を取得
    let os = get_os_type();

    // QRコード用ペイロードを作成
    let payload = RegistrationQrPayload {
        v: 1,
        terminal_id,
        public_key: BASE64.encode(verifying_key.to_bytes()),
        device_name: device_name.to_string(),
        os,
        created_at: now,
    };

    Ok(payload)
}

/// 署名を生成
#[cfg(not(target_os = "android"))]
pub fn sign_message(_message: &str) -> Result<SignatureData, TerminalAuthError> {
    let signing_key = load_private_key_from_keychain()?.ok_or(TerminalAuthError::NotInitialized)?;
    let terminal_id = load_terminal_id_from_keychain()?.ok_or(TerminalAuthError::NotInitialized)?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| TerminalAuthError::CryptoError(e.to_string()))?
        .as_secs();

    // 署名対象のメッセージを構築
    let sign_message = format!("{}:{}", terminal_id, timestamp);
    let signature: Signature = signing_key.sign(sign_message.as_bytes());

    Ok(SignatureData {
        terminal_id,
        timestamp,
        signature: BASE64.encode(signature.to_bytes()),
    })
}

/// 認証用の署名データを生成
#[cfg(not(target_os = "android"))]
pub fn create_auth_signature() -> Result<SignatureData, TerminalAuthError> {
    sign_message("")
}

/// 現在時刻をISO8601形式で取得（簡易実装）
fn chrono_now_iso8601() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // 簡易的なISO8601形式（実際にはchronoクレートを使うべき）
    format!("{}Z", now)
}

/// OS種別を取得
fn get_os_type() -> String {
    #[cfg(target_os = "macos")]
    return "macos".to_string();

    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();

    #[cfg(target_os = "android")]
    return "android".to_string();

    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "android"
    )))]
    return "unknown".to_string();
}

// Android用のスタブ実装（後で実装）
#[cfg(target_os = "android")]
fn load_private_key_from_keychain() -> Result<Option<SigningKey>, TerminalAuthError> {
    // TODO: Android Keystore実装
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
fn save_private_key_to_keychain(_signing_key: &SigningKey, _terminal_id: &str) -> Result<(), TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
fn load_terminal_id_from_keychain() -> Result<Option<String>, TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
fn save_terminal_id_to_keychain(_terminal_id: &str) -> Result<(), TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
pub fn clear_keychain() -> Result<(), TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
pub fn get_terminal_status() -> Result<TerminalAuthResult, TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
pub fn initialize_terminal(_device_name: &str) -> Result<RegistrationQrPayload, TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
pub fn sign_message(_message: &str) -> Result<SignatureData, TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(target_os = "android")]
pub fn create_auth_signature() -> Result<SignatureData, TerminalAuthError> {
    Err(TerminalAuthError::KeychainError(
        "Android Keystore not implemented yet".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_os_type() {
        let os = get_os_type();
        assert!(!os.is_empty());
    }
}
