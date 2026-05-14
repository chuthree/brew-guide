package com.brewguide.online;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(name = "BrewGuideGallery")
public class BrewGuideGalleryPlugin extends Plugin {

    private static final String DEFAULT_ALBUM_NAME = "BrewGuide";
    private static final String MIME_TYPE_PNG = "image/png";

    @PluginMethod
    public void savePngDataUrl(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null || dataUrl.trim().isEmpty()) {
            call.reject("Image data is required");
            return;
        }

        byte[] imageBytes;
        try {
            imageBytes = decodeDataUrl(dataUrl);
        } catch (IllegalArgumentException exception) {
            call.reject("Invalid PNG data URL", exception);
            return;
        }

        String fileName = sanitizeFileName(
            call.getString("fileName", "brew-guide-" + System.currentTimeMillis())
        );
        String albumName = sanitizePathSegment(
            call.getString("albumName", DEFAULT_ALBUM_NAME)
        );
        String displayName = ensurePngExtension(fileName);

        ContentResolver resolver = getContext().getContentResolver();
        Uri imageUri = null;
        String scanPath = getPublicImagePath(albumName, displayName);

        try {
            ContentValues values = createImageValues(albumName, displayName, scanPath);
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
            MediaScannerConnection.scanFile(
                getContext(),
                new String[] { scanPath },
                new String[] { MIME_TYPE_PNG },
                null
            );

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

    private byte[] decodeDataUrl(String dataUrl) {
        int commaIndex = dataUrl.indexOf(',');
        String base64Data = commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
        return Base64.decode(base64Data, Base64.DEFAULT);
    }

    private ContentValues createImageValues(
        String albumName,
        String displayName,
        String scanPath
    ) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, displayName);
        values.put(MediaStore.Images.Media.MIME_TYPE, MIME_TYPE_PNG);

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

    private String ensurePngExtension(String fileName) {
        return fileName.toLowerCase(Locale.US).endsWith(".png")
            ? fileName
            : fileName + ".png";
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
