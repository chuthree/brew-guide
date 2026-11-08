/** Shared extraction contract for image recognition and AI bean tools.
 * Keep this module runtime-neutral: the recognition function runs as plain JS.
 */
export const BEAN_IMPORT_RULES = `字段规则：
- 只使用用户明确提供或当前包装上可读、可归属的事实；未知直接省略，不要填猜测值或“未标注”。商家联系地址不是咖啡产地；包装列出的多个规格、产品类别不代表当前这袋的规格或类型。
- 同一信息同时存在中文和英文时，优先中文；只有没有中文时才保留英文。用户要求翻译时可翻译普通产地/风味词，但不要杜撰品牌官方中文名。
- name 保留包装醒目的商品名、批次名或主标题；中英文主标题可以一起保留，例如 "OBRAJE 哥伦比亚奥博拉赫庄园"。不要把正文产地、处理法、风味额外拼进名称；名称与结构化字段合理重叠不算重复。无主标题才使用最醒目的可见专名作保守备用名称。
- roaster 使用包装明确的品牌名，明显有中文品牌时优先中文名；完整多词品牌必须保留，不自行缩成首词。烘焙商未知可省略，不影响导入。生豆商、进口商、供应商不是烘焙商，写为备注，例如“生豆商：裂豆师”。
- 容量、剩余量以克计，按当前入口 schema 的 capacity/remaining 或 capacityGrams/remainingGrams 填数字；不确定当前规格时省略。price 按入口 schema 保留币种，不能凭包装猜价格。startDay/endDay 仅来自明确的赏味期/养豆天数。
- roastDate 仅来自可读的烘焙/生产日期，格式 YYYY-MM-DD；缺少可确认的年份或月日、非法日期都不填，不用默认 01-01。
- roastLevel 只用：极浅烘焙/浅度烘焙/中浅烘焙/中度烘焙/中深烘焙/深度烘焙。按可读标签规范，不从深浅、重量猜其他信息。
- beanType 只用 filter/espresso/omni，按明确的用途填写；品类列表或深烘、拼配、大包装不能证明是意式或全能，未知省略。
- flavor 为字符串数组，只写风味词，不把宣传语当风味。
- blendComponents 必须是对象数组，不用字符串数组或 components/blend_components 等别名。每个对象对应同一成分；按标签顺序保留产地与处理法的配对、明确比例。多品种在同一成分中使用字符串数组，不拆 SL28/34 这类品种内部斜杠。不要为了单独一行品种另建成分。
- estate 只表示庄园/农场，processingStation 只表示处理站/水洗站（Station/Washing Station），两者不混用。74158 等明确品种编号可写 variety，批次写 batch；不要仅凭编号或名称覆盖另一个明确品种。
- notes 只保存没有适合字段的真实补充信息，如系列、生豆商、批次、海拔或用户原话中的口感描述。规范标签使用“标签：值”，多条用“ / ”分隔，拼配禁用字段用“成分1 标签：值”等保留归属。
- 已有字段的信息优先填字段，不重复写“包装标注：……”摘要；不写“未标注/看不清”等识别过程、不写联系信息、物流促销、包装锁鲜技术、人物背书或奖项广告。真实自由备注、与字段冲突且待确认的信息不能擅自删掉。
- 不编造，不输出当前入口 schema 以外的字段。更新只提交本次明确修改的字段，省略不代表清空；不要顺带改写历史自由备注。`;

export const BEAN_RECOGNITION_PROMPT = `任务：从咖啡豆包装图片提取可见文字信息，返回可导入JSON。
输出：单豆返回object，多豆返回array。只输出JSON，不输出解释、markdown或代码块。

允许字段：
name 必填；roaster；capacity；remaining；price；roastDate；roastLevel；beanType；flavor；startDay；endDay；blendComponents；notes。

${BEAN_IMPORT_RULES}

blendComponents 形状示例：
{"blendComponents":[{"origin":"埃塞俄比亚","estate":"某庄园","processingStation":"博纳","process":"水洗","variety":"74158"}]}`;

/** @param {{ id: string, label: string }[]} definitions
 * @param {string[]} enabledFields
 */
export function buildBeanImportFieldRules(definitions, enabledFields) {
  const enabled = new Set(enabledFields);
  const fieldLabels = enabledFields
    .map(
      id => `${id}=${definitions.find(field => field.id === id)?.label || id}`
    )
    .join('；');
  const disabledLabels = definitions
    .filter(field => !enabled.has(field.id))
    .map(field => field.label)
    .join('、');
  const legacyOrigin =
    enabled.has('origin') && !enabled.has('country') && !enabled.has('region');
  return `最终咖啡豆字段约束（必须优先于上文和用户自定义提示词）：
- blendComponents 每个对象只允许输出这些成分字段：${enabledFields.join('/') || '无'}；字段含义：${fieldLabels || '无'}。明确的 percentage 比例仍可保留。
- origin 是未结构化的“产地概括”，只有允许 origin 时才输出；不要把 origin 当成产国。
- ${legacyOrigin ? '当前使用产地概括：将同一成分明确的产国、产区合并填入 origin，不要仅写进备注。' : '已启用的精细产地字段分别填写；不要从不明确的 origin 强拆或猜测产国、产区。'}
- 其他未启用字段（${disabledLabels || '无'}）明确可见时写入 notes，不丢失信息；已由 origin 完整表达的产国、产区不重复写备注。
- estate 仅表示庄园/农场，processingStation 仅表示处理站/水洗站；名称含“站”、“Station”或“Washing Station”时优先判定为处理站，不要写入 estate。
- batch 是批次，altitude 是海拔；对应字段启用时写入 blendComponents，否则写入 notes。
- 已启用字段优先写入 blendComponents，不要同时重复写入 notes；name 是包装展示标题，与结构化字段合理重叠不算重复。
- 严禁输出未允许的 blendComponents 键。`;
}
