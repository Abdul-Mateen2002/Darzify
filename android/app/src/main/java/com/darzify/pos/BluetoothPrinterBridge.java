package com.darzify.pos;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Darzify Android Native Bluetooth Classic (RFCOMM/SPP) Bridge
 * Specifically designed for SpeedX and standard 58mm ESC/POS thermal printers.
 * Uses standard SerialPortServiceClass UUID: 00001101-0000-1000-8000-00805F9B34FB
 */
public class BluetoothPrinterBridge {
    private static final String TAG = "DarzifyPrinterBridge";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final Context context;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket currentSocket;
    private OutputStream outputStream;
    private String connectedDeviceName = null;

    public BluetoothPrinterBridge(Context context) {
        this.context = context;
        try {
            this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        } catch (Exception e) {
            Log.e(TAG, "BluetoothAdapter error", e);
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled();
    }

    @JavascriptInterface
    public String getPairedPrinters() {
        JSONArray jsonArray = new JSONArray();
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            return jsonArray.toString();
        }

        try {
            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSONObject obj = new JSONObject();
                    obj.put("name", device.getName() != null ? device.getName() : "Unknown Printer");
                    obj.put("address", device.getAddress());
                    jsonArray.put(obj);
                }
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Bluetooth permission not granted", se);
        } catch (Exception e) {
            Log.e(TAG, "Error fetching paired devices", e);
        }

        return jsonArray.toString();
    }

    @JavascriptInterface
    public synchronized boolean connect(String macAddress) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            Log.w(TAG, "Bluetooth not enabled");
            return false;
        }

        disconnect();

        try {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(macAddress);
            if (device == null) {
                return false;
            }

            // Cancel discovery to optimize connection speed
            bluetoothAdapter.cancelDiscovery();

            currentSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            currentSocket.connect();
            outputStream = currentSocket.getOutputStream();
            connectedDeviceName = device.getName();
            Log.i(TAG, "Connected to printer: " + connectedDeviceName + " (" + macAddress + ")");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to connect to printer: " + macAddress, e);
            disconnect();
            return false;
        }
    }

    @JavascriptInterface
    public synchronized void disconnect() {
        try {
            if (outputStream != null) {
                outputStream.flush();
                outputStream.close();
            }
            if (currentSocket != null) {
                currentSocket.close();
            }
        } catch (IOException e) {
            Log.e(TAG, "Error closing Bluetooth socket", e);
        } finally {
            outputStream = null;
            currentSocket = null;
            connectedDeviceName = null;
        }
    }

    @JavascriptInterface
    public synchronized boolean isConnected() {
        return currentSocket != null && currentSocket.isConnected();
    }

    @JavascriptInterface
    public String getConnectedDeviceName() {
        return connectedDeviceName != null ? connectedDeviceName : "";
    }

    @JavascriptInterface
    public synchronized boolean printBase64(String base64Data) {
        if (!isConnected() || outputStream == null) {
            Log.e(TAG, "Cannot print: printer is not connected");
            return false;
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            // Chunk stream in 512-byte packets to prevent buffer overflow on mobile thermal printers
            int chunkSize = 512;
            for (int i = 0; i < bytes.length; i += chunkSize) {
                int length = Math.min(chunkSize, bytes.length - i);
                outputStream.write(bytes, i, length);
                outputStream.flush();
                try {
                    Thread.sleep(10);
                } catch (InterruptedException ignored) {}
            }
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Printing failed", e);
            return false;
        }
    }
}
