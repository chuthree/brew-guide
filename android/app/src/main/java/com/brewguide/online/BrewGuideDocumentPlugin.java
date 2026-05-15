package com.brewguide.online;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "BrewGuideDocument")
public class BrewGuideDocumentPlugin extends Plugin {

    private static final String DEFAULT_MIME_TYPE = "application/octet-stream";

    @PluginMethod
    public void saveFile(PluginCall call) {
        String sourceUri = call.getString("sourceUri");
        String fileName = sanitizeFileName(
            call.getString("fileName", "brew-guide-export")
        );
        String mimeType = call.getString("mimeType", DEFAULT_MIME_TYPE);

        if (sourceUri == null || sourceUri.trim().isEmpty()) {
            call.reject("Source file URI is required");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        );

        try {
            startActivityForResult(call, intent, "saveFileResult");
        } catch (ActivityNotFoundException exception) {
            saveToDownloads(call, Uri.parse(sourceUri), fileName, mimeType);
        }
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("保存已取消");
            return;
        }

        Uri destinationUri = result.getData().getData();
        if (destinationUri == null) {
            call.reject("未选择保存位置");
            return;
        }

        String sourceUriValue = call.getString("sourceUri");
        if (sourceUriValue == null || sourceUriValue.trim().isEmpty()) {
            call.reject("Source file URI is required");
            return;
        }

        try {
            copyFile(Uri.parse(sourceUriValue), destinationUri);

            JSObject response = new JSObject();
            response.put("uri", destinationUri.toString());
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("保存文件失败", exception);
        }
    }

    private void copyFile(Uri sourceUri, Uri destinationUri) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();

        try (
            InputStream inputStream = openInputStream(resolver, sourceUri);
            OutputStream outputStream = openOutputStream(resolver, destinationUri)
        ) {
            if (inputStream == null) {
                throw new IllegalStateException("无法读取导出文件");
            }

            if (outputStream == null) {
                throw new IllegalStateException("无法写入目标文件");
            }

            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
            }
            outputStream.flush();
        }
    }

    private void saveToDownloads(PluginCall call, Uri sourceUri, String fileName, String mimeType) {
        try {
            Uri destinationUri = createDownloadsFile(fileName, mimeType);
            copyFile(sourceUri, destinationUri);
            scanPublicFileIfNeeded(destinationUri, mimeType);

            JSObject response = new JSObject();
            response.put("uri", destinationUri.toString());
            response.put("directory", Environment.DIRECTORY_DOWNLOADS);
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("保存文件失败", exception);
        }
    }

    private Uri createDownloadsFile(String fileName, String mimeType) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

            Uri uri = getContext()
                .getContentResolver()
                .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

            if (uri == null) {
                throw new IllegalStateException("无法创建下载目录文件");
            }

            return uri;
        }

        File downloadsDirectory = Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_DOWNLOADS
        );
        if (!downloadsDirectory.exists() && !downloadsDirectory.mkdirs()) {
            throw new IllegalStateException("无法创建下载目录");
        }

        return Uri.fromFile(new File(downloadsDirectory, fileName));
    }

    private InputStream openInputStream(ContentResolver resolver, Uri uri) throws Exception {
        if (ContentResolver.SCHEME_FILE.equals(uri.getScheme())) {
            String path = uri.getPath();
            if (path == null) {
                throw new IllegalArgumentException("Invalid file URI");
            }
            return new FileInputStream(new File(path));
        }

        return resolver.openInputStream(uri);
    }

    private OutputStream openOutputStream(ContentResolver resolver, Uri uri) throws Exception {
        if (ContentResolver.SCHEME_FILE.equals(uri.getScheme())) {
            String path = uri.getPath();
            if (path == null) {
                throw new IllegalArgumentException("Invalid file URI");
            }
            return new FileOutputStream(new File(path));
        }

        return resolver.openOutputStream(uri, "wt");
    }

    private void scanPublicFileIfNeeded(Uri uri, String mimeType) {
        if (!ContentResolver.SCHEME_FILE.equals(uri.getScheme())) {
            return;
        }

        String path = uri.getPath();
        if (path == null) {
            return;
        }

        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { path },
            new String[] { mimeType },
            null
        );
    }

    private String sanitizeFileName(String fileName) {
        String sanitized = fileName.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        return sanitized.isEmpty() ? "brew-guide-export" : sanitized;
    }
}
