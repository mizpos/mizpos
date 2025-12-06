package cab.miz.pos.desktop

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

class MainActivity : TauriActivity() {
    private lateinit var printer: CitizenPrinter
    private lateinit var terminalAuth: TerminalAuth
    private val BLUETOOTH_PERMISSION_REQUEST_CODE = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        printer = CitizenPrinter(this)
        terminalAuth = TerminalAuth(this)
        requestBluetoothPermissions()
        hideSystemUI()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        // Add JavaScript interface for printer control
        webView.addJavascriptInterface(PrinterBridge(), "MizPosPrinter")
        // Add JavaScript interface for terminal authentication
        webView.addJavascriptInterface(TerminalAuthBridge(), "MizPosTerminalAuth")
    }

    private fun requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val permissions = arrayOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            )
            val permissionsToRequest = permissions.filter {
                ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
            }
            if (permissionsToRequest.isNotEmpty()) {
                ActivityCompat.requestPermissions(
                    this,
                    permissionsToRequest.toTypedArray(),
                    BLUETOOTH_PERMISSION_REQUEST_CODE
                )
            }
        }
    }

    override fun onDestroy() {
        printer.disconnect()
        super.onDestroy()
    }

    /**
     * JavaScript Interface for Bluetooth printer control
     * These methods can be called from JavaScript as:
     * - window.MizPosPrinter.getPairedDevices()
     * - window.MizPosPrinter.connect(address)
     * - etc.
     */
    inner class PrinterBridge {
        // 金額をカンマ区切りでフォーマット
        private fun formatPrice(amount: Int): String {
            val formatter = NumberFormat.getNumberInstance(Locale.JAPAN)
            return "\\${formatter.format(amount)}"
        }

        @JavascriptInterface
        fun getPairedDevices(): String {
            return try {
                val devices = printer.getPairedDevices()
                val jsonArray = JSONArray()
                devices.forEach { device ->
                    val obj = JSONObject()
                    obj.put("address", device["address"])
                    obj.put("name", device["name"])
                    jsonArray.put(obj)
                }
                JSONObject().apply {
                    put("success", true)
                    put("devices", jsonArray)
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun connect(address: String): String {
            return try {
                val success = printer.connect(address)
                JSONObject().apply {
                    put("success", success)
                    if (!success) put("error", "Failed to connect")
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun disconnect(): String {
            return try {
                printer.disconnect()
                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun isConnected(): String {
            return JSONObject().apply {
                put("success", true)
                put("connected", printer.isConnected())
            }.toString()
        }

        @JavascriptInterface
        fun printText(text: String): String {
            return try {
                if (!printer.isConnected()) {
                    return JSONObject().apply {
                        put("success", false)
                        put("error", "Printer not connected")
                    }.toString()
                }
                printer.init()
                printer.printLine(text)
                printer.feed(3)
                printer.cut()
                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun welcomePrint(terminalId: String): String {
            return welcomePrintWithWidth(terminalId, CitizenPrinter.PAPER_58MM)
        }

        @JavascriptInterface
        fun welcomePrintWithWidth(terminalId: String, paperWidth: Int): String {
            return try {
                if (!printer.isConnected()) {
                    return JSONObject().apply {
                        put("success", false)
                        put("error", "Printer not connected")
                    }.toString()
                }
                val success = printer.printWelcome(terminalId, paperWidth)
                JSONObject().apply {
                    put("success", success)
                    if (!success) put("error", "Print failed")
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun printReceipt(jsonData: String): String {
            return try {
                if (!printer.isConnected()) {
                    return JSONObject().apply {
                        put("success", false)
                        put("error", "Printer not connected")
                    }.toString()
                }

                val data = JSONObject(jsonData)
                val paperWidth = data.optInt("paperWidth", CitizenPrinter.PAPER_58MM)
                printer.init(paperWidth)

                // イベント名
                val circleName = data.optString("circle_name", "")
                if (circleName.isNotEmpty()) {
                    printer.printDoubleCentered(circleName)
                }

                // 会場住所（イベント名の下）
                val venueAddress = data.optString("venue_address", "")
                val eventName = data.optString("event_name", "")
                if (venueAddress.isNotEmpty() && eventName.isNotEmpty()) {
                    printer.printBoldLine(eventName);
                    printer.printLine(venueAddress);
                }

                // ご明細書（大きめの文字・中央揃え・黒背景）
                printer.printDoubleReverse("　　ご明細書　　")

                val receiptNumber = data.optString("receipt_number", "")
                printer.printLine("# $receiptNumber");

                // 責ID
                val saleStartDateTime = data.optString("sale_start_date_time", "")
                val staffId = data.optString("staff_id", "")
                if (staffId.isNotEmpty()) {
                    printer.printLine("$saleStartDateTime 責: $staffId")
                }

                printer.printSeparator(paperWidth)

                // 商品明細
                if (data.has("items")) {
                    val items = data.getJSONArray("items")
                    for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        val shopName = item.optString("shop_name", "")
                        val productName = item.optString("product_name", "")
                        val productNumber = item.optString("product_number", "")
                        val isdn = item.optString("isdn", "")
                        val jan2 = item.optString("jan2", "")
                        val isBook = item.optBoolean("is_book", false)
                        val unitPrice = item.optInt("unit_price", 0)
                        val qty = item.optInt("quantity", 1)

                        // 商品番号: 書籍の場合は「ISDN Cコード 値段」、それ以外はJAN
                        val displayNumber = if (isBook && isdn.isNotEmpty() && jan2.isNotEmpty()) {
                            // jan2からCコードと値段を抽出（例: 1920094001600 → C0094 ¥1,600）
                            val cCode = if (jan2.length >= 7) "C${jan2.substring(3, 7)}" else ""
                            val priceStr = if (jan2.length >= 9) {
                                val priceValue = jan2.substring(8,12).trimStart('0').toIntOrNull() ?: 0
                                formatPrice(priceValue)
                            } else ""
                            "$isdn $cCode $priceStr"
                        } else {
                            productNumber
                        }

                        printer.printBoldLine(displayNumber)
                        printer.printLine("$shopName / $productName")
                        // @{単価} x {点数} （右寄せ）
                        printer.printRightBold("@ ${formatPrice(unitPrice)}　 $qty 点　${formatPrice(unitPrice * qty)}")
                    }
                }

                printer.printSeparator(paperWidth)

                // 合計（税込）（太字・右寄せ）
                val subtotal = data.optInt("subtotal", 0)
                printer.printRowBold("合計(税込)", formatPrice(subtotal), paperWidth)

                // 内税表示
                val taxRate = data.optInt("tax_rate", 0)
                val taxAmount = data.optInt("tax_amount", 0)
                if (taxRate > 0 && taxAmount > 0) {
                    printer.printRow("(内 ${taxRate}%税)", formatPrice(taxAmount), paperWidth)
                }

                // クーポン処理
                val couponDiscount = data.optInt("coupon_discount", 0)
                if (couponDiscount > 0) {
                    printer.printRow("　 クーポン割引", "-${formatPrice(couponDiscount)}", paperWidth)
                }

                // 支払い方法
                val paymentMethod = data.optString("payment_method", "")
                val paymentAmount = data.optInt("payment_amount", 0)
                if (paymentMethod.isNotEmpty()) {
                    printer.printRow("　 $paymentMethod", formatPrice(paymentAmount), paperWidth)
                }

                // 釣り銭
                val change = data.optInt("change", 0)
                if (change > 0) {
                    printer.printRow("　 釣り銭", formatPrice(change), paperWidth)
                }

                if (receiptNumber.isNotEmpty()) {
                    printer.printSeparator(paperWidth)
                    printer.printLine("当店は免税事業者であり、適格請求書を発行することはできません。返品・返金は落丁・乱丁の場合のみ受け付けます。返品・返金の場合は本明細書を添付しサポートセンター support-pos@miz.cabにご連絡ください。");
                    printer.printLine("")
                    // QRコード（レシート番号）
                    printer.printQrCode(receiptNumber, 6)
                }

                printer.feed(3)
                printer.cut()

                JSONObject().apply {
                    put("success", true)
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }
    }

    /**
     * JavaScript Interface for Terminal Authentication
     * These methods can be called from JavaScript as:
     * - window.MizPosTerminalAuth.getTerminalStatus()
     * - window.MizPosTerminalAuth.saveKeyPair(terminalId, privateKey, publicKey)
     * - window.MizPosTerminalAuth.getPrivateKey()
     * - window.MizPosTerminalAuth.clearKeychain()
     */
    inner class TerminalAuthBridge {
        @JavascriptInterface
        fun getTerminalStatus(): String {
            return try {
                val status = terminalAuth.getTerminalStatus()
                JSONObject().apply {
                    put("success", true)
                    put("status", status["status"])
                    put("terminal_id", status["terminal_id"])
                    put("public_key", status["public_key"])
                    put("error", status["error"])
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun saveKeyPair(terminalId: String, privateKeyBase64: String, publicKeyBase64: String): String {
            return try {
                val success = terminalAuth.saveKeyPair(terminalId, privateKeyBase64, publicKeyBase64)
                JSONObject().apply {
                    put("success", success)
                    if (!success) put("error", "Failed to save key pair")
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun getPrivateKey(): String {
            return try {
                val privateKeyBytes = terminalAuth.getPrivateKeyBytes()
                if (privateKeyBytes != null) {
                    JSONObject().apply {
                        put("success", true)
                        put("private_key", android.util.Base64.encodeToString(privateKeyBytes, android.util.Base64.NO_WRAP))
                    }.toString()
                } else {
                    JSONObject().apply {
                        put("success", false)
                        put("error", "No private key found")
                    }.toString()
                }
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }

        @JavascriptInterface
        fun clearKeychain(): String {
            return try {
                val success = terminalAuth.clearKeychain()
                JSONObject().apply {
                    put("success", success)
                    if (!success) put("error", "Failed to clear keychain")
                }.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }.toString()
            }
        }
    }
}
