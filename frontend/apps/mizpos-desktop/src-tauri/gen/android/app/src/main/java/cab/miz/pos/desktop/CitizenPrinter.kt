package cab.miz.pos.desktop

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

/**
 * Citizen CMP-30II Bluetooth ESC/POS Printer Handler
 *
 * This class provides Bluetooth printing functionality for Citizen CMP-30II printer.
 * It uses standard Bluetooth SPP (Serial Port Profile) with ESC/POS commands.
 */
class CitizenPrinter(private val context: Context) {

    companion object {
        private const val TAG = "CitizenPrinter"
        // Standard SPP UUID for Bluetooth serial communication
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        // ESC/POS Commands
        private val ESC_INIT = byteArrayOf(0x1B, 0x40) // Initialize printer
        private val ESC_CUT = byteArrayOf(0x1D, 0x56, 0x00) // Full cut
        private val ESC_FEED = byteArrayOf(0x1B, 0x64) // Feed n lines
        private val ESC_BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
        private val ESC_BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)
        private val ESC_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
        private val ESC_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
        private val ESC_UNDERLINE_ON = byteArrayOf(0x1B, 0x2D, 0x01)
        private val ESC_UNDERLINE_OFF = byteArrayOf(0x1B, 0x2D, 0x00)

        // Japanese character set (Shift-JIS for CMP-30II)
        private val ESC_KANJI_MODE = byteArrayOf(0x1C, 0x26) // Enable Kanji mode
        private val ESC_KANJI_OFF = byteArrayOf(0x1C, 0x2E) // Disable Kanji mode
    }

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var connectedDevice: BluetoothDevice? = null

    init {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
    }

    /**
     * Get list of paired Bluetooth devices
     */
    @SuppressLint("MissingPermission")
    fun getPairedDevices(): List<Map<String, String>> {
        val devices = mutableListOf<Map<String, String>>()

        bluetoothAdapter?.bondedDevices?.forEach { device ->
            devices.add(mapOf(
                "address" to device.address,
                "name" to (device.name ?: "Unknown")
            ))
        }

        return devices
    }

    /**
     * Connect to a Bluetooth printer by address
     */
    @SuppressLint("MissingPermission")
    fun connect(address: String): Boolean {
        try {
            val device = bluetoothAdapter?.getRemoteDevice(address) ?: return false

            // Cancel discovery to speed up connection
            bluetoothAdapter?.cancelDiscovery()

            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket?.connect()
            outputStream = socket?.outputStream
            connectedDevice = device

            Log.i(TAG, "Connected to printer: ${device.name}")
            return true
        } catch (e: IOException) {
            Log.e(TAG, "Connection failed: ${e.message}")
            disconnect()
            return false
        }
    }

    /**
     * Disconnect from the printer
     */
    fun disconnect() {
        try {
            outputStream?.close()
            socket?.close()
        } catch (e: IOException) {
            Log.e(TAG, "Disconnect error: ${e.message}")
        } finally {
            outputStream = null
            socket = null
            connectedDevice = null
        }
    }

    /**
     * Check if connected to a printer
     */
    fun isConnected(): Boolean {
        return socket?.isConnected == true
    }

    /**
     * Initialize printer
     */
    fun init(): Boolean {
        return write(ESC_INIT)
    }

    /**
     * Print text (supports Japanese via Shift-JIS)
     */
    fun printText(text: String): Boolean {
        val bytes = text.toByteArray(Charsets.UTF_8)
        // Convert to Shift-JIS for Japanese support
        val shiftJisBytes = try {
            text.toByteArray(charset("Shift_JIS"))
        } catch (e: Exception) {
            bytes
        }
        return write(shiftJisBytes)
    }

    /**
     * Print text with newline
     */
    fun printLine(text: String): Boolean {
        return printText(text + "\n")
    }

    /**
     * Print Japanese text (enables Kanji mode)
     */
    fun printJapanese(text: String): Boolean {
        write(ESC_KANJI_MODE)
        val result = printText(text)
        write(ESC_KANJI_OFF)
        return result
    }

    /**
     * Print centered text
     */
    fun printCentered(text: String): Boolean {
        write(ESC_CENTER)
        val result = printLine(text)
        write(ESC_LEFT)
        return result
    }

    /**
     * Print bold text
     */
    fun printBold(text: String): Boolean {
        write(ESC_BOLD_ON)
        val result = printText(text)
        write(ESC_BOLD_OFF)
        return result
    }

    /**
     * Feed paper by n lines
     */
    fun feed(lines: Int): Boolean {
        return write(ESC_FEED + byteArrayOf(lines.toByte()))
    }

    /**
     * Cut paper
     */
    fun cut(): Boolean {
        return write(ESC_CUT)
    }

    /**
     * Print separator line
     */
    fun printSeparator(width: Int = 32): Boolean {
        return printLine("-".repeat(width))
    }

    /**
     * Print welcome message (for testing)
     */
    fun printWelcome(terminalId: String): Boolean {
        if (!isConnected()) return false

        init()

        // Header
        write(ESC_BOLD_ON)
        write(ESC_UNDERLINE_ON)
        printCentered("WELCOME TO mizPOS")
        write(ESC_UNDERLINE_OFF)
        write(ESC_BOLD_OFF)

        printLine("")

        // Japanese text
        write(ESC_KANJI_MODE)
        printCentered("mizPOS デスクトップターミナル")
        printCentered("接続テスト完了")
        write(ESC_KANJI_OFF)

        printLine("")
        printSeparator()

        // Terminal ID
        printLine("ターミナルID: $terminalId")

        printSeparator()
        printLine("")

        // Japanese test
        write(ESC_BOLD_ON)
        write(ESC_KANJI_MODE)
        printLine("日本語印刷テスト")
        write(ESC_BOLD_OFF)
        printLine("ひらがな: あいうえお")
        printLine("カタカナ: アイウエオ")
        printLine("漢字: 東京都渋谷区")
        write(ESC_KANJI_OFF)

        printLine("")
        feed(3)
        cut()

        return true
    }

    /**
     * Write raw bytes to printer
     */
    private fun write(data: ByteArray): Boolean {
        return try {
            outputStream?.write(data)
            outputStream?.flush()
            true
        } catch (e: IOException) {
            Log.e(TAG, "Write error: ${e.message}")
            false
        }
    }
}
