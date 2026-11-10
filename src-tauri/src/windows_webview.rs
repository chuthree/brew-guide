use tauri::{Context, Url, WebviewUrl, WebviewWindow, Wry};
use tauri_plugin_dialog::DialogExt;
use webview2_com::{
    ClearBrowsingDataCompletedHandler,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Profile2, ICoreWebView2_13, COREWEBVIEW2_BROWSING_DATA_KINDS,
        COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE,
        COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS,
    },
};
use windows_core::Interface;

pub fn prepare_main_window(mut context: Context<Wry>) -> (Context<Wry>, Option<Url>) {
    if tauri::is_dev() {
        return (context, None);
    }
    let app_url = context
        .config_mut()
        .app
        .windows
        .iter_mut()
        .find(|window| window.label == "main" && window.create)
        .map(|window| {
            let scheme = if window.use_https_scheme {
                "https"
            } else {
                "http"
            };
            // Keep cached scripts out until WebView2 finishes cleaning up.
            window.url = WebviewUrl::External("about:blank".parse().unwrap());
            Url::parse(&format!("{scheme}://tauri.localhost/")).unwrap()
        });
    (context, app_url)
}

pub fn load_main_window(window: WebviewWindow, app_url: Url) -> tauri::Result<()> {
    let main = window.clone();
    window.with_webview(move |webview| {
        let ready_window = main.clone();
        let ready_url = app_url.clone();
        let completed = ClearBrowsingDataCompletedHandler::create(Box::new(move |result| {
            load_app(&ready_window, ready_url, result);
            Ok(())
        }));
        let kinds = COREWEBVIEW2_BROWSING_DATA_KINDS(
            COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS.0
                | COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE.0,
        );
        let cleanup = unsafe {
            (|| {
                let core = webview
                    .controller()
                    .CoreWebView2()?
                    .cast::<ICoreWebView2_13>()?;
                let profile = core.Profile()?.cast::<ICoreWebView2Profile2>()?;
                profile.ClearBrowsingData(kinds, &completed)
            })()
        };
        if cleanup.is_err() {
            load_app(&main, app_url, cleanup);
        }
    })
}

fn load_app(window: &WebviewWindow, url: Url, cleanup: windows_core::Result<()>) {
    let navigation = window.navigate(url);
    if let Err(error) = navigation {
        window
            .dialog()
            .message(format!("无法打开 Brew Guide。\n{error}"))
            .show(|_| {});
    } else if let Err(error) = cleanup {
        window
            .dialog()
            .message(format!("无法更新界面缓存。请更新 Microsoft Edge WebView2 Runtime 后重启 Brew Guide。\n{error}"))
            .show(|_| {});
    }
}
