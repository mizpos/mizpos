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

class MainActivity : TauriActivity() {
    private lateinit var printer: CitizenPrinter
    private val BLUETOOTH_PERMISSION_REQUEST_CODE = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        printer = CitizenPrinter(this)
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
                printer.init()

                // Header
                if (data.has("header")) {
                    printer.printCentered(data.getString("header"))
                    printer.printLine("")
                }

                // Items
                if (data.has("items")) {
                    val items = data.getJSONArray("items")
                    printer.printSeparator(paperWidth)
                    for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        val name = item.getString("name")
                        val price = item.getString("price")
                        val qty = item.optInt("quantity", 1)
                        printer.printLine("$name x$qty")
                        printer.printLine("  ¥$price")
                    }
                    printer.printSeparator(paperWidth)
                }

                // Total
                if (data.has("total")) {
                    printer.printBold("合計: ¥${data.getString("total")}")
                    printer.printLine("")
                }

                // Footer
                if (data.has("footer")) {
                    printer.printLine("")
                    printer.printCentered(data.getString("footer"))
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
}
