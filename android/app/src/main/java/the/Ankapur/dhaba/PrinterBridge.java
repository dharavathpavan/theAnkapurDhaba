package the.Ankapur.dhaba;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

public class PrinterBridge {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final Context context;

    public PrinterBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public String scanPrinters() {
        JSONArray array = new JSONArray();
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter != null && adapter.isEnabled()) {
                Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
                if (pairedDevices != null) {
                    for (BluetoothDevice device : pairedDevices) {
                        String name = device.getName() != null ? device.getName() : "Bluetooth Printer";
                        String address = device.getAddress();
                        
                        JSONObject obj = new JSONObject();
                        obj.put("id", address);
                        obj.put("name", name);
                        obj.put("model", name.contains("EZO") ? "EZO 58D" : "Thermal Printer");
                        obj.put("macAddress", address);
                        obj.put("connectionType", "android-bridge");
                        obj.put("status", "available");
                        array.put(obj);
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return array.toString();
    }

    @JavascriptInterface
    public String printEscPos(String payloadJson) {
        JSONObject result = new JSONObject();
        String jobId = "";
        try {
            JSONObject payload = new JSONObject(payloadJson);
            jobId = payload.optString("jobId", UUID.randomUUID().toString());
            String payloadBase64 = payload.optString("payloadBase64", "");
            String targetAddress = payload.optString("printerId", null);
            int copies = payload.optInt("copies", 1);

            if (payloadBase64.isEmpty()) {
                result.put("jobId", jobId);
                result.put("status", "failed");
                result.put("message", "Empty payload");
                return result.toString();
            }

            byte[] rawBytes = Base64.decode(payloadBase64, Base64.DEFAULT);

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                result.put("jobId", jobId);
                result.put("status", "failed");
                result.put("message", "Bluetooth is disabled or not supported on this device");
                return result.toString();
            }

            BluetoothDevice targetDevice = null;
            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            if (paired != null) {
                for (BluetoothDevice device : paired) {
                    if (targetAddress != null && targetAddress.equalsIgnoreCase(device.getAddress())) {
                        targetDevice = device;
                        break;
                    }
                    String name = device.getName();
                    if (name != null && (name.toLowerCase().contains("printer") || name.toLowerCase().contains("ezo") || name.toLowerCase().contains("pos") || name.toLowerCase().contains("58d"))) {
                        if (targetDevice == null) targetDevice = device;
                    }
                }
                if (targetDevice == null && !paired.isEmpty()) {
                    targetDevice = paired.iterator().next();
                }
            }

            if (targetDevice == null) {
                result.put("jobId", jobId);
                result.put("status", "failed");
                result.put("message", "No paired Bluetooth thermal printer found. Please pair printer in Android Bluetooth settings.");
                return result.toString();
            }

            adapter.cancelDiscovery();
            BluetoothSocket socket = targetDevice.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();

            OutputStream out = socket.getOutputStream();
            for (int i = 0; i < Math.max(1, copies); i++) {
                out.write(rawBytes);
                out.flush();
            }

            Thread.sleep(300);
            out.close();
            socket.close();

            String timeStr = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date());
            result.put("jobId", jobId);
            result.put("status", "success");
            result.put("printedAt", timeStr);
            return result.toString();

        } catch (Exception e) {
            e.printStackTrace();
            try {
                result.put("jobId", jobId);
                result.put("status", "failed");
                result.put("message", e.getMessage() != null ? e.getMessage() : "Bluetooth print failed");
            } catch (Exception ignored) {}
            return result.toString();
        }
    }
}
