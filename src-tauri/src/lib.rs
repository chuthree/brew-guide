use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager, Emitter, Listener,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

// 全局状态：托盘图标是否可见
struct TrayState {
    visible: bool,
}

impl Default for TrayState {
    fn default() -> Self {
        Self { visible: true }
    }
}

// 咖啡豆数据结构（简化版，用于菜单栏显示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoffeeBean {
    pub id: String,
    pub name: String,
    pub remaining: Option<String>,
    pub capacity: Option<String>,
    pub roast_date: Option<String>,
    pub start_day: Option<i32>,
    pub end_day: Option<i32>,
    pub is_frozen: Option<bool>,
    pub is_in_transit: Option<bool>,  // 是否在途状态
}

// 计算赏味期状态
#[derive(Debug, Clone)]
pub struct BeanFreshnessInfo {
    pub bean: CoffeeBean,
    pub days_since_roast: i32,
    pub start_day: i32,
    pub end_day: i32,
    pub freshness_state: FreshnessState,  // 赏味期状态
    pub progress_percent: f32,            // 赏味期进度 (0-100)
}

// 赏味期状态分类（与前端 FlavorPeriodStatus 保持一致）
#[derive(Debug, Clone, PartialEq)]
pub enum FreshnessState {
    Resting,    // 养豆期（未到 start_day）
    Optimal,    // 最佳赏味期（start_day ~ end_day）
    Decline,    // 衰退期（超过 end_day）
    Frozen,     // 冷冻中
    InTransit,  // 在途（尚未收到）
    Unknown,    // 未知（没有烘焙日期）
}

// 从前端获取咖啡豆数据的命令
#[tauri::command]
fn update_tray_menu(app: tauri::AppHandle, beans: Vec<CoffeeBean>) -> Result<(), String> {
    update_tray_with_beans(&app, beans).map_err(|e| e.to_string())
}

// 设置托盘图标可见性
#[tauri::command]
fn set_tray_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(tray) = app.tray_by_id("main-tray") {
            tray.set_visible(visible).map_err(|e| e.to_string())?;
            
            // 更新全局状态
            if let Some(state) = app.try_state::<Arc<Mutex<TrayState>>>() {
                if let Ok(mut s) = state.lock() {
                    s.visible = visible;
                }
            }
            
            // macOS: 根据托盘图标可见性调整 Dock 图标显示
            #[cfg(target_os = "macos")]
            {
                if visible {
                    // 显示托盘图标时，隐藏 Dock 图标
                    let _ = app.set_activation_policy(ActivationPolicy::Accessory);
                } else {
                    // 隐藏托盘图标时，显示 Dock 图标（普通应用模式）
                    let _ = app.set_activation_policy(ActivationPolicy::Regular);
                }
            }
        }
    }
    Ok(())
}

fn calculate_freshness(bean: &CoffeeBean) -> BeanFreshnessInfo {
    let today = chrono::Local::now().date_naive();
    
    let days_since_roast = if let Some(ref roast_date) = bean.roast_date {
        if let Ok(date) = chrono::NaiveDate::parse_from_str(roast_date, "%Y-%m-%d") {
            (today - date).num_days() as i32
        } else {
            0
        }
    } else {
        0
    };
    
    let start_day = bean.start_day.unwrap_or(7);
    let end_day = bean.end_day.unwrap_or(30);
    let is_frozen = bean.is_frozen.unwrap_or(false);
    
    let is_in_transit = bean.is_in_transit.unwrap_or(false);
    
    // 判断赏味期状态（与前端 calculateFlavorInfo 保持一致）
    let freshness_state = if is_in_transit {
        FreshnessState::InTransit
    } else if is_frozen {
        FreshnessState::Frozen
    } else if bean.roast_date.is_none() {
        FreshnessState::Unknown
    } else if days_since_roast < start_day {
        FreshnessState::Resting
    } else if days_since_roast <= end_day {
        FreshnessState::Optimal
    } else {
        FreshnessState::Decline
    };
    
    // 计算赏味期进度：从 start_day 到 end_day 的百分比
    let optimal_duration = (end_day - start_day) as f32;
    let days_in_optimal = (days_since_roast - start_day) as f32;
    let progress_percent = if optimal_duration > 0.0 && freshness_state == FreshnessState::Optimal {
        (days_in_optimal / optimal_duration * 100.0).min(100.0).max(0.0)
    } else if days_since_roast > end_day {
        100.0
    } else {
        0.0
    };
    
    BeanFreshnessInfo {
        bean: bean.clone(),
        days_since_roast,
        start_day,
        end_day,
        freshness_state,
        progress_percent,
    }
}

// 截断字符串，确保不超过指定长度（考虑中文字符宽度）
fn truncate_name(name: &str, max_width: usize) -> String {
    let mut width = 0;
    let mut result = String::new();
    
    for c in name.chars() {
        // 中文字符占2个宽度，ASCII占1个
        let char_width = if c.is_ascii() { 1 } else { 2 };
        if width + char_width > max_width {
            result.push('…');
            break;
        }
        result.push(c);
        width += char_width;
    }
    
    // 填充空格使宽度一致
    while width < max_width {
        result.push(' ');
        width += 1;
    }
    
    result
}

// 格式化容量显示
fn format_capacity(grams: f64) -> String {
    if grams >= 1000.0 {
        format!("{:.2}kg", grams / 1000.0)
    } else {
        format!("{}g", grams as i32)
    }
}

fn update_tray_with_beans(app: &tauri::AppHandle, beans: Vec<CoffeeBean>) -> Result<(), Box<dyn std::error::Error>> {
    // 过滤出有剩余量的咖啡豆
    let active_beans: Vec<BeanFreshnessInfo> = beans
        .iter()
        .filter(|b| {
            if let Some(ref remaining) = b.remaining {
                let amount: f64 = remaining.parse().unwrap_or(0.0);
                amount > 0.0
            } else {
                false
            }
        })
        .map(|b| calculate_freshness(b))
        .collect();
    
    // 按赏味期状态分类
    let mut optimal_beans: Vec<&BeanFreshnessInfo> = active_beans
        .iter()
        .filter(|b| b.freshness_state == FreshnessState::Optimal)
        .collect();
    let mut resting_beans: Vec<&BeanFreshnessInfo> = active_beans
        .iter()
        .filter(|b| b.freshness_state == FreshnessState::Resting)
        .collect();
    let mut decline_beans: Vec<&BeanFreshnessInfo> = active_beans
        .iter()
        .filter(|b| b.freshness_state == FreshnessState::Decline)
        .collect();
    let frozen_beans: Vec<&BeanFreshnessInfo> = active_beans
        .iter()
        .filter(|b| b.freshness_state == FreshnessState::Frozen)
        .collect();
    let in_transit_beans: Vec<&BeanFreshnessInfo> = active_beans
        .iter()
        .filter(|b| b.freshness_state == FreshnessState::InTransit)
        .collect();
    
    // 排序：最佳赏味期按剩余天数升序（快过期的排前面）
    optimal_beans.sort_by(|a, b| {
        let a_left = a.end_day - a.days_since_roast;
        let b_left = b.end_day - b.days_since_roast;
        a_left.cmp(&b_left)
    });
    
    // 养豆期按剩余天数升序（快进入赏味期的排前面）
    resting_beans.sort_by(|a, b| {
        let a_left = a.start_day - a.days_since_roast;
        let b_left = b.start_day - b.days_since_roast;
        a_left.cmp(&b_left)
    });
    
    // 衰退期按过期天数升序
    decline_beans.sort_by(|a, b| a.days_since_roast.cmp(&b.days_since_roast));
    
    // === 统计数据 ===
    let bean_count = active_beans.len();
    let total_capacity: f64 = active_beans
        .iter()
        .filter_map(|b| b.bean.remaining.as_ref()?.parse::<f64>().ok())
        .sum();
    
    // 构建菜单
    let mut menu_builder = MenuBuilder::new(app);
    
    // === 第一块：统计信息 ===
    let count_item = MenuItemBuilder::with_id("stat_count", format!("库存数量：{} 款", bean_count))
        .enabled(false)
        .build(app)?;
    
    let capacity_item = MenuItemBuilder::with_id("stat_capacity", format!("库存容量：{}", format_capacity(total_capacity)))
        .enabled(false)
        .build(app)?;
    
    menu_builder = menu_builder
        .item(&count_item)
        .item(&capacity_item)
        .separator();
    
    // === 第二块：按赏味期分类的子菜单 ===
    // 排序：冷冻中 / 赏味期 / 养豆期 / 衰退期 / 在途中
    
    // 1. 冷冻中
    if !frozen_beans.is_empty() {
        let mut submenu = SubmenuBuilder::new(app, format!("冷冻中（{} 款）", frozen_beans.len()));
        for info in frozen_beans.iter() {
            let name = truncate_name(&info.bean.name, 16);
            let item = MenuItemBuilder::with_id(format!("bean:{}", info.bean.id), name).build(app)?;
            submenu = submenu.item(&item);
        }
        menu_builder = menu_builder.item(&submenu.build()?);
    }
    
    // 2. 赏味期
    if !optimal_beans.is_empty() {
        let mut submenu = SubmenuBuilder::new(app, format!("赏味期（{} 款）", optimal_beans.len()));
        for info in optimal_beans.iter() {
            let days_left = info.end_day - info.days_since_roast;
            let name = truncate_name(&info.bean.name, 16);
            let label = format!("{:>2} 天 · {}", days_left, name);
            // 使用 bean: 前缀 + 咖啡豆 ID 作为菜单项 ID
            let item = MenuItemBuilder::with_id(format!("bean:{}", info.bean.id), label).build(app)?;
            submenu = submenu.item(&item);
        }
        menu_builder = menu_builder.item(&submenu.build()?);
    }
    
    // 3. 养豆期
    if !resting_beans.is_empty() {
        let mut submenu = SubmenuBuilder::new(app, format!("养豆期（{} 款）", resting_beans.len()));
        for info in resting_beans.iter() {
            let days_until_optimal = info.start_day - info.days_since_roast;
            let name = truncate_name(&info.bean.name, 16);
            let label = format!("{:>2} 天 · {}", days_until_optimal, name);
            let item = MenuItemBuilder::with_id(format!("bean:{}", info.bean.id), label).build(app)?;
            submenu = submenu.item(&item);
        }
        menu_builder = menu_builder.item(&submenu.build()?);
    }
    
    // 4. 衰退期
    if !decline_beans.is_empty() {
        let mut submenu = SubmenuBuilder::new(app, format!("衰退期（{} 款）", decline_beans.len()));
        for info in decline_beans.iter() {
            let days_over = info.days_since_roast - info.end_day;
            let name = truncate_name(&info.bean.name, 16);
            let label = format!("+{} 天 · {}", days_over, name);
            let item = MenuItemBuilder::with_id(format!("bean:{}", info.bean.id), label).build(app)?;
            submenu = submenu.item(&item);
        }
        menu_builder = menu_builder.item(&submenu.build()?);
    }
    
    // 5. 在途中
    if !in_transit_beans.is_empty() {
        let mut submenu = SubmenuBuilder::new(app, format!("在途中（{} 款）", in_transit_beans.len()));
        for info in in_transit_beans.iter() {
            let name = truncate_name(&info.bean.name, 16);
            let item = MenuItemBuilder::with_id(format!("bean:{}", info.bean.id), name).build(app)?;
            submenu = submenu.item(&item);
        }
        menu_builder = menu_builder.item(&submenu.build()?);
    }
    
    // 如果没有任何咖啡豆
    if active_beans.is_empty() {
        let empty = MenuItemBuilder::with_id("empty", "暂无咖啡豆库存")
            .enabled(false)
            .build(app)?;
        menu_builder = menu_builder.item(&empty);
    }
    
    // === 底部操作 ===
    let open_app = MenuItemBuilder::with_id("open_app", "打开 Brew Guide")
        .build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出")
        .build(app)?;
    
    menu_builder = menu_builder
        .separator()
        .item(&open_app)
        .item(&quit);
    
    let menu = menu_builder.build()?;
    
    // 更新托盘菜单
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu))?;
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // 初始化托盘状态
            app.manage(Arc::new(Mutex::new(TrayState::default())));
            
            // 监听应用激活事件（点击 Dock 图标时显示窗口）
            #[cfg(desktop)]
            {
                let app_handle = app.handle().clone();
                app.listen("tauri://activated", move |_| {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                });
            }
            
            // 监听窗口关闭事件（仅桌面端）
            #[cfg(desktop)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let app_handle = app.handle().clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            // 检查托盘图标是否可见
                            let tray_visible = if let Some(state) = app_handle.try_state::<Arc<Mutex<TrayState>>>() {
                                state.lock().map(|s| s.visible).unwrap_or(false)
                            } else {
                                false
                            };
                            
                            if tray_visible {
                                // 托盘图标可见时：阻止关闭，隐藏窗口
                                api.prevent_close();
                                let _ = app_handle.get_webview_window("main").unwrap().hide();
                                
                                // macOS: 窗口隐藏后重新隐藏 Dock 图标
                                #[cfg(target_os = "macos")]
                                {
                                    let _ = app_handle.set_activation_policy(ActivationPolicy::Accessory);
                                }
                            }
                            // 托盘图标不可见时：允许关闭（退出应用）
                        }
                    });
                }
            }
            
            // 创建系统托盘图标（仅桌面端）
            #[cfg(desktop)]
            {
                // 创建初始菜单
                let count_item = MenuItemBuilder::with_id("stat_count", "库存数量：- 款")
                    .enabled(false)
                    .build(app)?;
                let capacity_item = MenuItemBuilder::with_id("stat_capacity", "库存容量：-")
                    .enabled(false)
                    .build(app)?;
                let loading = MenuItemBuilder::with_id("loading", "加载中…")
                    .enabled(false)
                    .build(app)?;
                let open_app = MenuItemBuilder::with_id("open_app", "打开 Brew Guide")
                    .build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "退出")
                    .build(app)?;
                
                let menu = MenuBuilder::new(app)
                    .item(&count_item)
                    .item(&capacity_item)
                    .separator()
                    .item(&loading)
                    .separator()
                    .item(&open_app)
                    .item(&quit)
                    .build()?;
                
                // 加载托盘图标
                // macOS: 使用模板图标，系统会自动适配深色/浅色模式
                // Windows: 使用白色填充的图标，在深色任务栏上更清晰
                #[cfg(target_os = "macos")]
                let icon = Image::from_path("icons/tray-iconTemplate@2x.png")
                    .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/tray-iconTemplate@2x.png")).unwrap());
                
                #[cfg(target_os = "windows")]
                let icon = Image::from_path("icons/tray-icon-win.png")
                    .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/tray-icon-win.png")).unwrap());
                
                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                let icon = Image::from_path("icons/tray-iconTemplate@2x.png")
                    .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/tray-iconTemplate@2x.png")).unwrap());
                
                let _tray = TrayIconBuilder::with_id("main-tray")
                    .icon(icon)
                    .icon_as_template(cfg!(target_os = "macos"))
                    .menu(&menu)
                    .tooltip("Brew Guide")
                    .on_menu_event(|app, event| {
                        match event.id().as_ref() {
                            "open_app" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            id if id.starts_with("bean:") => {
                                // 解析咖啡豆 ID
                                let bean_id = id.strip_prefix("bean:").unwrap_or("");
                                
                                // 显示窗口
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                                
                                // 发送事件给前端，携带咖啡豆 ID
                                let _ = app.emit("navigate-to-bean", bean_id);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
                
                // macOS: 默认隐藏 Dock 图标，因为托盘图标存在
                #[cfg(target_os = "macos")]
                {
                    let _ = app.set_activation_policy(ActivationPolicy::Accessory);
                }
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![update_tray_menu, set_tray_visible])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: 点击 Dock 图标时重新显示窗口
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}
