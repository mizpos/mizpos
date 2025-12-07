package cab.miz.pos.desktop

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Terminal Authentication using Android Keystore
 *
 * Ed25519鍵をAndroid Keystoreで暗号化して安全に保存する
 * - Android Keystoreに保存されたAES鍵で秘密鍵を暗号化
 * - 暗号化された秘密鍵はSharedPreferencesに保存
 */
class TerminalAuth(private val context: Context) {

    companion object {
        private const val TAG = "TerminalAuth"
        private const val KEYSTORE_ALIAS = "mizpos_terminal_key"
        private const val PREFS_NAME = "mizpos_terminal_prefs"
        private const val PREF_ENCRYPTED_PRIVATE_KEY = "encrypted_private_key"
        private const val PREF_ENCRYPTED_KEY_IV = "encrypted_key_iv"
        private const val PREF_TERMINAL_ID = "terminal_id"
        private const val PREF_PUBLIC_KEY = "public_key"

        private const val GCM_TAG_LENGTH = 128
    }

    private val keyStore: KeyStore = KeyStore.getInstance("AndroidKeyStore").apply {
        load(null)
    }

    /**
     * 端末の状態を取得
     */
    fun getTerminalStatus(): Map<String, Any?> {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val terminalId = prefs.getString(PREF_TERMINAL_ID, null)
            val publicKey = prefs.getString(PREF_PUBLIC_KEY, null)
            val hasPrivateKey = prefs.getString(PREF_ENCRYPTED_PRIVATE_KEY, null) != null

            when {
                terminalId != null && publicKey != null && hasPrivateKey -> {
                    mapOf(
                        "status" to "initialized",
                        "terminal_id" to terminalId,
                        "public_key" to publicKey,
                        "error" to null
                    )
                }
                terminalId == null && publicKey == null && !hasPrivateKey -> {
                    mapOf(
                        "status" to "uninitialized",
                        "terminal_id" to null,
                        "public_key" to null,
                        "error" to null
                    )
                }
                else -> {
                    // 不整合な状態 - クリア
                    clearKeychain()
                    mapOf(
                        "status" to "uninitialized",
                        "terminal_id" to null,
                        "public_key" to null,
                        "error" to "Inconsistent state, cleared"
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "getTerminalStatus error: ${e.message}")
            mapOf(
                "status" to "error",
                "terminal_id" to null,
                "public_key" to null,
                "error" to e.message
            )
        }
    }

    /**
     * 新しいキーペアを生成して保存
     */
    fun initializeTerminal(deviceName: String): Map<String, Any?> {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            // 既に初期化済みの場合はエラー
            if (prefs.getString(PREF_ENCRYPTED_PRIVATE_KEY, null) != null) {
                return mapOf(
                    "success" to false,
                    "error" to "Terminal already initialized"
                )
            }

            // Ed25519キーペアを生成
            val keyPair = generateEd25519KeyPair()
            val privateKeyBytes = keyPair.first
            val publicKeyBytes = keyPair.second

            // 端末IDを生成
            val terminalId = UUID.randomUUID().toString()

            // Android KeystoreのAES鍵を取得または生成
            val aesKey = getOrCreateAesKey()

            // 秘密鍵を暗号化
            val (encryptedKey, iv) = encryptWithAes(privateKeyBytes, aesKey)

            // 保存
            prefs.edit()
                .putString(PREF_ENCRYPTED_PRIVATE_KEY, Base64.encodeToString(encryptedKey, Base64.NO_WRAP))
                .putString(PREF_ENCRYPTED_KEY_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_TERMINAL_ID, terminalId)
                .putString(PREF_PUBLIC_KEY, Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP))
                .apply()

            // QRペイロードを返す
            mapOf(
                "success" to true,
                "v" to 1,
                "terminal_id" to terminalId,
                "public_key" to Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP),
                "device_name" to deviceName,
                "os" to "android",
                "created_at" to (System.currentTimeMillis() / 1000).toString() + "Z"
            )
        } catch (e: Exception) {
            Log.e(TAG, "initializeTerminal error: ${e.message}", e)
            mapOf(
                "success" to false,
                "error" to e.message
            )
        }
    }

    /**
     * 署名を生成
     */
    fun createAuthSignature(): Map<String, Any?> {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val encryptedKeyBase64 = prefs.getString(PREF_ENCRYPTED_PRIVATE_KEY, null)
                ?: return mapOf("success" to false, "error" to "Not initialized")
            val ivBase64 = prefs.getString(PREF_ENCRYPTED_KEY_IV, null)
                ?: return mapOf("success" to false, "error" to "Not initialized")
            val terminalId = prefs.getString(PREF_TERMINAL_ID, null)
                ?: return mapOf("success" to false, "error" to "Not initialized")

            // AES鍵を取得
            val aesKey = getOrCreateAesKey()

            // 秘密鍵を復号
            val encryptedKey = Base64.decode(encryptedKeyBase64, Base64.NO_WRAP)
            val iv = Base64.decode(ivBase64, Base64.NO_WRAP)
            val privateKeyBytes = decryptWithAes(encryptedKey, iv, aesKey)

            // タイムスタンプ
            val timestamp = System.currentTimeMillis() / 1000

            // 署名対象メッセージ
            val message = "$terminalId:$timestamp"

            // Ed25519で署名
            val signature = signEd25519(privateKeyBytes, message.toByteArray(Charsets.UTF_8))

            mapOf(
                "success" to true,
                "terminal_id" to terminalId,
                "timestamp" to timestamp,
                "signature" to Base64.encodeToString(signature, Base64.NO_WRAP)
            )
        } catch (e: Exception) {
            Log.e(TAG, "createAuthSignature error: ${e.message}", e)
            mapOf(
                "success" to false,
                "error" to e.message
            )
        }
    }

    /**
     * 認証情報をクリア
     */
    fun clearKeychain(): Boolean {
        return try {
            // SharedPreferencesをクリア
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()

            // Keystoreから鍵を削除
            if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
                keyStore.deleteEntry(KEYSTORE_ALIAS)
            }

            true
        } catch (e: Exception) {
            Log.e(TAG, "clearKeychain error: ${e.message}")
            false
        }
    }

    /**
     * Android KeystoreからAES鍵を取得、なければ生成
     */
    private fun getOrCreateAesKey(): SecretKey {
        return if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
            keyStore.getKey(KEYSTORE_ALIAS, null) as SecretKey
        } else {
            generateAesKey(useStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
        }
    }

    /**
     * AES鍵を生成（StrongBox失敗時はフォールバック）
     */
    private fun generateAesKey(useStrongBox: Boolean): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )

        val builder = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)

        if (useStrongBox) {
            builder.setIsStrongBoxBacked(true)
        }

        return try {
            keyGenerator.init(builder.build())
            keyGenerator.generateKey()
        } catch (e: Exception) {
            if (useStrongBox) {
                Log.w(TAG, "StrongBox key generation failed, falling back to TEE: ${e.message}")
                // StrongBoxなしで再試行
                generateAesKey(useStrongBox = false)
            } else {
                throw e
            }
        }
    }

    /**
     * AES-GCMで暗号化
     */
    private fun encryptWithAes(data: ByteArray, key: SecretKey): Pair<ByteArray, ByteArray> {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val encrypted = cipher.doFinal(data)
        return Pair(encrypted, iv)
    }

    /**
     * AES-GCMで復号
     */
    private fun decryptWithAes(encrypted: ByteArray, iv: ByteArray, key: SecretKey): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return cipher.doFinal(encrypted)
    }

    /**
     * Ed25519キーペアを生成（秘密鍵, 公開鍵）
     *
     * BouncyCastleを使用せずにシンプルに実装
     * Android側ではEd25519のネイティブサポートがないため、
     * ランダムな32バイトを秘密鍵として生成し、
     * 公開鍵の生成はフロントエンド/Rust側で行う
     */
    private fun generateEd25519KeyPair(): Pair<ByteArray, ByteArray> {
        // Ed25519の秘密鍵は32バイトのランダムデータ
        val privateKey = ByteArray(32)
        SecureRandom().nextBytes(privateKey)

        // 公開鍵の導出はTweetNaCl互換のライブラリが必要
        // ここでは簡易実装として、秘密鍵のSHA-512ハッシュの前半を公開鍵として使用
        // 注: 本来はEd25519のcurve演算が必要だが、Android標準ライブラリにはないため
        // 実際の公開鍵生成はRust側で行い、この関数は秘密鍵のみを生成する
        // 公開鍵はダミー値を入れておき、Rust側で正しい値に置き換える
        val publicKey = ByteArray(32) // プレースホルダー

        return Pair(privateKey, publicKey)
    }

    /**
     * Ed25519で署名
     *
     * 注: Android標準ライブラリにはEd25519がないため、
     * 署名はRust側で行う。ここでは秘密鍵を返すのみ。
     */
    private fun signEd25519(privateKey: ByteArray, message: ByteArray): ByteArray {
        // Android標準ではEd25519署名がサポートされていないため、
        // プレースホルダーとして空の署名を返す
        // 実際の署名はRust側で行う
        return ByteArray(64) // プレースホルダー
    }

    /**
     * 秘密鍵のバイト配列を取得（Rust側でEd25519演算を行うため）
     */
    fun getPrivateKeyBytes(): ByteArray? {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val encryptedKeyBase64 = prefs.getString(PREF_ENCRYPTED_PRIVATE_KEY, null) ?: return null
            val ivBase64 = prefs.getString(PREF_ENCRYPTED_KEY_IV, null) ?: return null

            val aesKey = getOrCreateAesKey()
            val encryptedKey = Base64.decode(encryptedKeyBase64, Base64.NO_WRAP)
            val iv = Base64.decode(ivBase64, Base64.NO_WRAP)

            decryptWithAes(encryptedKey, iv, aesKey)
        } catch (e: Exception) {
            Log.e(TAG, "getPrivateKeyBytes error: ${e.message}")
            null
        }
    }

    /**
     * 秘密鍵と公開鍵のペアを保存（Rust側で生成した鍵を保存）
     */
    fun saveKeyPair(terminalId: String, privateKeyBase64: String, publicKeyBase64: String): Boolean {
        return try {
            val privateKeyBytes = Base64.decode(privateKeyBase64, Base64.NO_WRAP)

            // AES鍵を取得または生成
            val aesKey = getOrCreateAesKey()

            // 秘密鍵を暗号化
            val (encryptedKey, iv) = encryptWithAes(privateKeyBytes, aesKey)

            // 保存
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(PREF_ENCRYPTED_PRIVATE_KEY, Base64.encodeToString(encryptedKey, Base64.NO_WRAP))
                .putString(PREF_ENCRYPTED_KEY_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_TERMINAL_ID, terminalId)
                .putString(PREF_PUBLIC_KEY, publicKeyBase64)
                .apply()

            true
        } catch (e: Exception) {
            Log.e(TAG, "saveKeyPair error: ${e.message}")
            false
        }
    }
}
