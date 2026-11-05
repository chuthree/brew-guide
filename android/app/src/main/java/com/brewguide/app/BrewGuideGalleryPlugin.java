package com.brewguide.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(
    name = "BrewGuideGallery",
    permissions = @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
)
public class BrewGuideGalleryPlugin extends Plugin {

    private static final String DEFAULT_ALBUM_NAME = "BrewGuide";
    private static final String MIME_TYPE_PNG = "image/png";

    @PluginMethod
    public void saveImageDataUrl(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || dataUrl.trim().isEmpty()) {
            call.reject("Image data is required");
            return;
        }

        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            getPermissionState("storage") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }

        byte[] imageBytes;
        String mimeType;
        try {
            mimeType = getImageMimeType(dataUrl);
            imageBytes = decodeDataUrl(dataUrl);
            if (imageBytes.length == 0) {
                throw new IllegalArgumentException("Image data is empty");
            }
        } catch (IllegalArgumentException exception) {
            call.reject("Invalid image data URL", exception);
            return;
        }

        String fileName = sanitizeFileName(
            call.getString("fileName", "brew-guide-" + System.currentTimeMillis())
        );
        String albumName = sanitizePathSegment(
            call.getString("albumName", DEFAULT_ALBUM_NAME)
        );
        String displayName = ensureImageExtension(fileName, mimeType);

        ContentResolver resolver = getContext().getContentResolver();
        Uri imageUri = null;
        String scanPath = getPublicImagePath(albumName, displayName);

        try {
            ContentValues values = createImageValues(albumName, displayName, scanPath, mimeType);
            imageUri = resolver.insert(getImageCollectionUri(), values);
            if (imageUri == null) {
                call.reject("Unable to create MediaStore image entry");
                return;
            }

            try (OutputStream outputStream = resolver.openOutputStream(imageUri)) {
                if (outputStream == null) {
                    throw new IllegalStateException("Unable to open MediaStore output stream");
                }
                outputStream.write(imageBytes);
                outputStream.flush();
            }

            publishImage(resolver, imageUri);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { scanPath },
                    new String[] { mimeType },
                    null
                );
            }

            JSObject result = new JSObject();
            result.put("uri", imageUri.toString());
            call.resolve(result);
        } catch (Exception exception) {
            if (imageUri != null) {
                resolver.delete(imageUri, null, null);
            }
            call.reject("Unable to save image to gallery", exception);
        }
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            saveImageDataUrl(call);
        } else {
            call.reject("保存图片需要存储权限，请授权后重试");
        }
    }

    private String getImageMimeType(String dataUrl) {
        if (!dataUrl.startsWith("data:")) return MIME_TYPE_PNG;
        int commaIndex = dataUrl.indexOf(',');
        String header = commaIndex >= 0 ? dataUrl.substring(0, commaIndex) : dataUrl;
        switch (header) {
            case "data:image/png;base64": return MIME_TYPE_PNG;
            case "data:image/jpeg;base64": return "image/jpeg";
            case "data:image/webp;base64": return "image/webp";
            case "data:image/gif;base64": return "image/gif";
            default: throw new IllegalArgumentException("Unsupported image format");
        }
    }

    private byte[] decodeDataUrl(String dataUrl) {
        int commaIndex = dataUrl.indexOf(',');
        String base64Data = commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
        return Base64.decode(base64Data, Base64.DEFAULT);
    }

    private ContentValues createImageValues(
        String albumName,
        String displayName,
        String scanPath,
        String mimeType
    ) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, displayName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(
                MediaStore.Images.Media.RELATIVE_PATH,
                Environment.DIRECTORY_PICTURES + File.separator + albumName
            );
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        } else {
            File albumDir = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                albumName
            );
            if (!albumDir.exists() && !albumDir.mkdirs()) {
                throw new IllegalStateException("Unable to create gallery album directory");
            }
            values.put(MediaStore.Images.Media.DATA, scanPath);
        }

        return values;
    }

    private Uri getImageCollectionUri() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        }
        return MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
    }

    private void publishImage(ContentResolver resolver, Uri imageUri) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return;
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(imageUri, values, null, null);
    }

    private String getPublicImagePath(String albumName, String displayName) {
        return new File(
            new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                albumName
            ),
            displayName
        ).getAbsolutePath();
    }

    private String ensureImageExtension(String fileName, String mimeType) {
        String extension = "." + mimeType.substring("image/".length());
        return fileName.toLowerCase(Locale.US).endsWith(extension)
            ? fileName
            : fileName + extension;
    }

    private String sanitizeFileName(String fileName) {
        String sanitized = fileName.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        return sanitized.isEmpty() ? "brew-guide-" + System.currentTimeMillis() : sanitized;
    }

    private String sanitizePathSegment(String segment) {
        String sanitized = segment.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        return sanitized.isEmpty() ? DEFAULT_ALBUM_NAME : sanitized;
    }
}
