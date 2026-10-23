# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor 相关保留规则
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# 保留所有 native 方法
-keepclasseswithmembernames class * {
    native <methods>;
}

# WebView JavaScript 接口
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Provider uses Rhino's reflective VMBridge and a build-time serialized interpreter.
# Preserve classes AND members: renaming serialized fields/classes breaks business.bin.
# Keep this pinned runtime intact while the rest of the release remains optimized.
-keep class org.mozilla.javascript.** { *; }

# Optional dependencies are not part of the Android runtime.
-dontwarn org.mozilla.javascript.**
-dontwarn org.apache.commons.**

