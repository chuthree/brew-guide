# Android ContentProvider 接入指南

Brew Guide 通过 Android `ContentResolver` 向其他应用开放本机数据。

| 项目                       | 值                                    |
| -------------------------- | ------------------------------------- |
| 应用包名                   | `com.brewguide.app`                   |
| Provider 标识（authority） | `com.brewguide.app.data`              |
| 版本化根 URI               | `content://com.brewguide.app.data/v1` |
| 当前响应协议版本           | `contractVersion: 1`                  |

本指南独立说明 Android 应用所需的声明、授权、IPC、业务操作和错误处理。
字段名、必填参数及单项限制以运行时返回的 `inputSchema` 为准。
当前采用按领域划分的 `scopes` 权限契约，不兼容或自动升级旧布尔权限配置；
旧客户端需要重新请求授权。权限迁移不会改动已有业务数据。

## 1. 快速接入

1. 安装支持此接口的 Brew Guide Android 版本。
2. 声明 Provider 可见性，仅请求功能所需的权限，并由用户在前台主动打开授权入口。
3. 授权 Activity 返回后，重新调用 `get_access_status` 确认实际权限。
4. 调用 `get_capabilities` 取得操作及参数定义，使用查询返回的真实 ID。
5. 写入前持久保存唯一的 `requestId`、操作名称及完整参数，便于安全重试。

将 `<queries>` 放在清单的 `<manifest>` 直接子级，而不是 `<application>` 内：

```xml
<queries>
    <provider android:authorities="com.brewguide.app.data" />
</queries>
```

### 最小 Kotlin 授权客户端

示例依赖 AndroidX Activity、Lifecycle runtime KTX 和 Kotlin 协程，要求
`compileSdk >= 34`。将 `requestBeanRead()` 绑定到用户主动点击的按钮。
IPC 在 `Dispatchers.IO` 执行；Activity Result 回调每次创建 Activity 时都会注册，
回调中重新检查权限，而不是只相信 `RESULT_OK`。示例不会自动写入业务数据。

```kotlin
import android.app.ActivityOptions
import android.app.PendingIntent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityOptionsCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class BrewClientActivity : ComponentActivity() {
    private val root = Uri.parse("content://com.brewguide.app.data/v1")

    private suspend fun call(method: String, args: JSONObject): Bundle =
        withContext(Dispatchers.IO) {
            val extras = Bundle().apply {
                putString("arguments", args.toString())
            }
            requireNotNull(contentResolver.call(root, method, null, extras)) {
                "Provider 未返回响应"
            }
        }

    private fun json(bundle: Bundle): JSONObject =
        JSONObject(requireNotNull(bundle.getString("result")))

    private fun body(bundle: Bundle): JSONObject {
        val response = json(bundle)
        check(response.optBoolean("ok")) {
            response.optJSONObject("error")?.toString() ?: "响应格式无效"
        }
        return response.getJSONObject("result")
    }

    private val authorize = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) {
        lifecycleScope.launch {
            try {
                val scopes = body(call("get_access_status", JSONObject()))
                    .getJSONObject("scopes")
                val level = scopes.optString("beans")
                show(if (level == "read" || level == "edit")
                    "已获得咖啡豆访问权限" else "未获得咖啡豆访问权限")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                show(e.message ?: "无法读取授权状态")
            }
        }
    }

    fun requestBeanRead() {
        lifecycleScope.launch {
            try {
                val args = JSONObject().put(
                    "scopes", JSONObject().put("beans", "read")
                )
                val reply = call("request_access", args)
                // request_access 直接返回待授权对象，不使用 ok/result 包装。
                val pending = json(reply)
                check(pending.optString("status") == "pending") {
                    pending.optJSONObject("error")?.toString() ?: "没有待授权请求"
                }
                check(pending.getInt("contractVersion") == 1)
                @Suppress("DEPRECATION")
                val entry = if (Build.VERSION.SDK_INT >= 33)
                    reply.getParcelable("authorizationIntent", PendingIntent::class.java)
                else reply.getParcelable<PendingIntent>("authorizationIntent")
                requireNotNull(entry)
                check(entry.creatorPackage == "com.brewguide.app")
                val options = object : ActivityOptionsCompat() {
                    override fun toBundle(): Bundle {
                        val native = ActivityOptions.makeBasic()
                        if (Build.VERSION.SDK_INT >= 34) {
                            native.setPendingIntentBackgroundActivityStartMode(
                                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
                            )
                        }
                        return native.toBundle()
                    }
                }
                authorize.launch(
                    IntentSenderRequest.Builder(entry.intentSender).build(), options
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                show(e.message ?: "无法请求授权")
            }
        }
    }

    private fun show(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
```

示例中的异常会显示为界面提示，但不能据此推断后续业务写入一定失败。
正式客户端还应防止重复提交，并在自身进程重建后恢复待确认的业务操作。

## 2. 授权与身份

Provider 根据系统提供的 UID 核验已安装包、签名及安装身份；无法唯一确定应用的
共享 UID 会被拒绝。客户端不要传入自行声明的调用包名、回调 URI 或返回 Intent。
Android URI 授权不能绕过业务权限。授权保存在本设备，不进入数据导出或同步。

仅支持 `brewing`、`beans`、`notes`、`settings` 四个领域，每个已授权领域只能选择一个等级：

| 等级         | 允许的操作                     |
| ------------ | ------------------------------ |
| `read`       | 读取该领域                     |
| `edit`       | 读取、新增、修改，**包括删除** |
| 不提供该领域 | 未授权                         |

没有独立的 `write`、`delete` 授权等级。操作元数据中的这些词只是操作分类。
未知领域、未知等级、布尔权限对象及空授权请求都会被拒绝。

### 请求授权

`request_access` 只接受 `{"scopes":{"beans":"read"}}` 这样的参数结构。
返回 Bundle 包含 JSON 字符串 `result`、整数 `contractVersion`，以及不可变的
`PendingIntent` 类型 `authorizationIntent`。成功时，`result` 直接表示待授权请求：

```json
{
  "requestId": "<不透明的授权请求 ID>",
  "status": "pending",
  "expiresAt": 0,
  "contractVersion": 1
}
```

`expiresAt` 是实际到期时间的 Unix 毫秒时间戳，示例的 `0` 只用于展示结构。
请求有效期为五分钟，且绑定调用者身份。批准后，准确合并本次请求的权限；
取消、返回及关闭授权界面均不改变已有授权。

### 确认与撤销权限

授权返回后，以空对象 `{}` 调用 `get_access_status`：

```json
{ "ok": true, "result": { "scopes": { "beans": "read" } } }
```

授权 Activity 的返回 Intent 含有 `requestId` 和 `status`；仅 `approved` 使用
`RESULT_OK`，取消、无效请求或忙碌等结果可以返回 `RESULT_CANCELED`。
**返回码和 extras 不是实际授权凭证，仍须重新读取权限。**

`get_access_status` 可在未授权时调用，不需要初始化业务数据运行环境。
用户可在“设置 → 授权管理”管理或撤销权限。撤销会影响排队请求及提交事务时的检查；
历史成功请求的重放也需要当前权限，不能绕过撤销。

## 3. API 与操作发现

### `call` 请求和响应

调用 `contentResolver.call(root, toolName, null, extras)`，将 JSON 对象字符串放入
`extras["arguments"]`，`arg` 必须为 null。普通响应 Bundle 包含
`contractVersion: 1` 及 JSON 字符串 `result`：

```json
{ "ok": true, "result": { "scopes": { "beans": "read" } } }
```

```json
{ "ok": false, "error": { "code": "PERMISSION_DENIED", "message": "错误说明" } }
```

`request_access` 成功时使用上一节的直接待授权对象，是上述包装规则的例外。
不要假设所有业务结果拥有相同字段。

`get_capabilities` 接受 `{}`，返回实际 `scopes`、领域可用性、排除项及已授权 `tools`。
它要求调用者至少已有一个领域授权；尚未授权时先使用 `request_access` 和
`get_access_status`。每个操作包含 `name`、`readOnly`、`access`、`inputSchema`。
应读取运行时定义，不要维护一份复制出来的完整方法清单。
操作出现在列表中，不代表任意参数组合都已授权；关联数据可能增加权限要求。

### 查询与 Cursor

| `/v1` 后的 URI 路径       | 对应读取操作         |
| ------------------------- | -------------------- |
| `/beans`                  | `list_beans`         |
| `/notes`                  | `list_brew_notes`    |
| `/equipment`              | `list_equipment`     |
| `/methods`                | `list_method`        |
| `/grinders`               | `list_grinder`       |
| `/query/<read-tool-name>` | 已发现的其他读取操作 |

通过 URI 的 `arguments` 查询参数传 JSON，并使用 `Uri.Builder` 编码。
集合查询还接受 `limit`、`offset`。不要传 SQL `selection`、`selectionArgs` 或
`sortOrder`；`projection` 传 null 可取得可用列。

每行包含 `id`、`version`、`record_json`、标量字段及 `_id`。
**`_id` 只是当前页的 Cursor 行索引，不是业务 ID。**
Cursor extras 中有整数 `contractVersion`，以及保存其余结果元数据的 JSON 字符串 `page`。
嵌套或可空数据优先读取 `record_json`；用完必须关闭 Cursor。

```kotlin
// 放在 withContext(Dispatchers.IO) 中执行；需要 beans 的 read 或 edit。
val uri = root.buildUpon().appendPath("beans")
    .appendQueryParameter("limit", "25")
    .appendQueryParameter("offset", "0").build()
contentResolver.query(uri, null, null, null, null)?.use { cursor ->
    val recordColumn = cursor.getColumnIndexOrThrow("record_json")
    while (cursor.moveToNext()) {
        val record = JSONObject(cursor.getString(recordColumn))
        // 使用返回的业务 ID/version；回到界面线程后再更新 UI。
    }
}
```

原始表级 `update`、`delete` 不是业务写入接口；`insert` 仅用于图片上传。
业务修改必须使用操作目录中的 `call` 方法。

### 领域能力与权限依赖

表中的 `beans:read` 表示 `scopes` 中的 `"beans":"read"`，其他领域同理。

| 功能或操作                                                         | 最低权限                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| 器具、方法/配方、持久化 SVG/框架素材、冲煮目录偏好                 | 读取 `brewing:read`；修改 `brewing:edit`               |
| 咖啡豆、库存、烘焙、统计、历史报告归档                             | 读取 `beans:read`；修改 `beans:edit`，关联记录另行检查 |
| 笔记和笔记图片                                                     | 读取 `notes:read`；修改 `notes:edit`，库存关联另行检查 |
| 磨豆机/历史、分组、评分维度、烘焙商/标志、应用偏好                 | 读取 `settings:read`；修改 `settings:edit`             |
| `get_capabilities`、`list_mcp_activity`                            | 至少有一个领域授权；返回数据按权限过滤                 |
| 扣减或恢复库存的关联笔记                                           | `notes:edit` **以及** `beans:edit`                     |
| 预览删除库存关联笔记                                               | `notes:read` 以及 `beans:read`                         |
| 笔记显式提供 `equipmentId`、`methodId` 或 `applyMethodPreset:true` | 额外需要 `brewing:read`，已有 edit 也可                |
| 笔记实际修改磨豆机或历史                                           | 额外需要 `settings:edit`                               |
| `preview_convert_roasted_to_green`、`preview_roaster_rename`       | `beans`、`notes`、`settings` 均有 read 或 edit         |
| `convert_roasted_to_green`、`rename_roaster`                       | `beans`、`notes`、`settings` 均有 edit                 |

执行前还存在以下原生读取权限检查：

- `create_brew_note`、`update_brew_note`、`delete_brew_note`、容量调整、烘焙操作，
  以及记录级 `preview_delete` 都要求能够读取 beans **和** notes，
  即使某次调用不会修改两个领域。
- 删除咖啡豆、调整库存也要求 notes 读取权限。新增或修改库存调整/烘焙历史时，
  实际写入通常需要 beans 与 notes 都有 **edit**。
- 笔记 `note`/`changes` 中存在器具或方法 ID 键时，即使值为 null，也需要
  brewing 读取权限；未使用的引用键应省略。
- 磨豆机引用可能需要 settings 读取权限；实际同步历史还需要 edit。

预览是读取操作，不等于已经获准修改。其他关联数据也可能增加要求；
提交时会检查实际受影响的所有领域。权限不足时，不会只提交部分库存或历史修改。

### 关联浓缩笔记：一次写入，只扣一次库存

先查询并选择正确咖啡豆，再调用 `create_brew_note`。
下列占位 ID 必须替换成查询返回值；为本次操作生成并持久保存新的 UUID：

```json
{
  "requestId": "<持久保存的唯一 UUID>",
  "note": {
    "beanId": "<list_beans 返回的 ID>",
    "coffeeGrams": 18,
    "extractionTimeSeconds": 25,
    "liquidWeightGrams": 36
  }
}
```

其含义是 **18 g 粉量、25 s 萃取、36 g 出液量**。
`waterGrams` 是输入水量，不是出液量；`totalTimeSeconds` 是总冲煮时长，
不等于萃取时长。没有实际数据时不要虚构这两个字段。

关联笔记会原子扣减 18 g，例如库存由 100 g 变成 82 g。
**不要为同一次冲煮另外调用库存扣减。** 仅修改出液量或萃取时长不会再次扣减；
修改粉量或豆子关联时，会相应调整库存。更新这两个浓缩测量字段时，省略表示保留，
显式 `null` 表示清空。

补充已有消耗记录时，使用 `update_brew_note` 并设置 `recordType:"brew"`，
不要另建一条重复消耗。只记录消耗时使用 `recordType:"quick-decrement"`。
可选的 `brewedAt` 使用含明确时区的 RFC3339 时间；烘焙/购买日期使用 `YYYY-MM-DD`。

## 4. 安全写入、错误与重试

### 版本控制与删除预览

读取返回不透明的 `version`，需要并发控制的修改接受 `expectedVersion`。
没有通用的公开 `currentVersion` 字段。遇到 `CONFLICT`，应重新读取、向用户展示
当前状态，再以新 `requestId` 发起确认后的新操作，不要盲目覆盖。
图片修改可能还要求 `expectedImageVersion`，以该操作定义为准。

删除咖啡豆或笔记的流程：

1. 调用 `preview_delete`，例如 `{"entity":"brew_note","id":"<查询返回的 ID>"}`。
2. 向用户展示返回的 `record` 和 `impact`。响应包含 `entity`、`id`、`version`、
   `confirmationToken`、`expiresAt`。记录级影响包含 `recordsDeleted`、
   `imageVariantsRemoved`、`inventoryRestoration`（对象或 null）。恢复库存对象包含
   `beanId`、`recordedDoseGrams`、`deltaGrams`、`resultingRemainingGrams`、
   `currentRemainingGrams`、`cappedAtCapacityGrams`。
3. 用户明确确认后，调用 `delete_brew_note`，提供 `requestId`、`id`、
   `confirmationToken`，并将预览返回的 `version` 作为 `expectedVersion`。

确认令牌只能使用一次，有效期五分钟，绑定调用者、目标、版本及影响。
进程重启、数据重置或影响发生变化后，应重新预览。
`bean_image` 还需 `side`，`brew_note_image` 还需 `imageId`。
其他破坏性操作使用各自的预览及确认字段，不要套用同一参数结构。
有关联记录的豆子不能通过此接口级联删除。edit 权限允许删除，但不能替代操作确认。

### 幂等与未知结果

每次修改都要求 8–128 个字符的 `requestId`。应与操作名称、完整参数一起保存。
成功响应含 `requestId`、`replayed`；重放会返回已记录的结果，不再重复修改。
同一 ID 改用不同方法或参数会返回 `IDEMPOTENCY_CONFLICT`。

IPC 异常、超时、取消或进程退出可能使结果处于**未知状态**，不代表事务已回滚。
必须使用原方法、原 ID 和完全相同的参数重试，不能随手生成新 ID 再写一次。
已提交的结果可在普通进程重启后恢复。

明确收到校验失败或版本冲突，并经用户确认修正后，才以新 ID 提交新的操作。
未知结果重试时不要替换原参数中的确认令牌；先恢复原操作结果。

| 错误或情形                                | 建议处理                                   |
| ----------------------------------------- | ------------------------------------------ |
| `INVALID_ARGUMENT`                        | 按当前参数定义修正输入                     |
| `PERMISSION_DENIED`                       | 重新读取权限，由用户主动授权所需领域       |
| `NOT_FOUND`                               | 刷新并重新选择，不能猜测替代 ID            |
| `CONFLICT`                                | 重新读取并确认后再发起新修改               |
| `CONFIRMATION_REQUIRED`                   | 重新取得预览和用户确认                     |
| `IDEMPOTENCY_CONFLICT`                    | 检查是否错误复用了键，不要掩盖未知写入结果 |
| `MIGRATION_REQUIRED`                      | 请用户打开 Brew Guide 一次，完成旧数据迁移 |
| `BUSY`、`REQUEST_TIMEOUT`、超时或连接中断 | 退避后重试；写入仍使用原 ID 和原参数       |
| `USE_APP` 或不支持的方法错误              | 使用可用的专用操作或应用界面，不要盲目重试 |
| `INTERNAL_ERROR`、`OPERATION_FAILED`      | 检查当前数据；未知写入仍保留原 ID          |

上表不是完整错误枚举。普通 `call` 的业务失败使用 JSON 错误包装；身份核验或无效
IPC 也可能直接抛出 Android 异常。`query` 失败可能抛出包含错误 JSON 的
`IllegalArgumentException`；文件操作可能抛出文件或安全异常。
应单独捕获传输层异常，不能假设所有异常文本都是结构化 JSON。

## 5. 图片与变更通知

### 上传图片

使用调用者专属的临时上传 URI，不接受远程 URL 或任意文件系统路径：

1. 调用 `insert(root + "/uploads", values)`，在 `ContentValues` 中提供
   `domain`（`beans`、`notes` 或 `settings`）和 `mime_type`
   （`image/jpeg`、`image/png` 或 `image/webp`）。
2. 对返回 URI 使用 `openOutputStream(uri, "w")` 写入，完成后关闭流。
3. 将该 URI 填入相应操作的图片字符串字段，包括定义中名为 `dataUrl` 或
   `images` 的字段。保存原始完整参数，以便重试。

上传需要对应领域的 edit 权限。上传 URI 绑定身份，只能打开一次写入流，
有效期一小时，传输上限 8 MiB。已成功提交的幂等重放不再需要临时图片字节。
打开的流有时限，撤销权限时会关闭。不要跨应用共享上传 URI，也不要复用于另一修改。

业务校验还会检查格式、解码尺寸及单项限制：源图片不超过 8 MiB、3200 万像素，
每边不超过 16,384 像素；笔记最多 9 张图片，每次操作新增/替换的源图片合计
不超过 8 MiB；烘焙商标志输入不超过 5 MiB。
原生解码会处理 EXIF 方向并进行 WebP 压缩；压缩目标是尽力达到的目标，
不是输出字节数保证。图片和关联业务数据按事务规则处理，并执行失败清理。

### 读取图片与监听变更

显式调用 `get_bean_image`、`get_brew_note_image`、`get_roaster_logo` 后，
结果可能包含 `image.contentUri`。在非界面线程用 `openInputStream` 读取并及时关闭。
先检查状态：不存在、不可用或超限的图片不一定有 URI。

- 豆子/笔记图片使用 `image.status`。
- 标志图片必须传 `includeImage:true` 才返回字节，否则只有元数据；其状态为顶层
  `imageStatus`，可能为 `available`、`opaque`、`absent`、`unsupported_source`。

这些 URI 是受控的数据引用，不能绕过权限，也不是可跨设备同步的下载链接。
列表和活动记录不会嵌入图片字节。

在根 URI 注册 `ContentObserver`，启用后代通知；收到变更后重新查询。
不要将通知视为逐行事件或事务回执。通知用于刷新，写入响应用于确认操作结果。

## 6. 限制、生命周期与验证边界

- JSON 参数按 UTF-8 计算最多 512 KiB，图片应使用上传流。
- 业务执行最多等待 45 秒；等待超时不代表已回滚。上传流时限为 30 秒。
- 常规列表默认每页 25 条，允许 1–100 条，offset 从零开始；单项操作可能不同，
  以参数定义及返回的分页元数据为准。
- 普通进程冷启动支持无界面的业务操作。授权流程会打开界面：保留已打开的页面和
  草稿，或冷启动正常应用界面。
- 用户在 Android 中**强行停止**应用不同于普通进程退出。不要承诺唤醒被用户
  强行停止的应用；应请用户正常打开应用。
- 尚未迁移的旧 WebView 数据需要用户打开应用一次完成迁移。
- 交互计时器、相机/系统权限、账户凭据、同步密钥、整库导入/重置及任意文件不属于
  通用数据操作接口。平台特定操作即使能在目录发现，也可能明确返回不支持。
- 数据库文件、私有原生命令、内部桥接及生成资源属于实现细节，不是接入端点。

本文已对照当前 Provider 实现、参数定义及回归测试源码检查。
本版主 Activity 示例以 Kotlin 2.0.20 和 Android API 35 独立编译通过；这不等于
运行时测试。历史构建或测试通过也不代表真机/UI 验收。
接入方仍需在目标 Android 版本验证授权拒绝、撤销、重试、冷启动和强行停止等场景。

### 参考资料与维护

结构和客户端模式参考 Android 官方的
[ContentProvider 基础](https://developer.android.com/guide/topics/providers/content-provider-basics)及
[Activity Result API](https://developer.android.com/training/basics/intents/result)。
Brew Guide 的具体行为以其实际实现和运行时参数定义为准，不能从通用模板推断。
维护时应同时核对原生 Provider、授权存储、操作定义、权限检查及事务逻辑；
不要把内部源码路径或私有函数作为第三方接入契约。
