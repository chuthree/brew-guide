import {
  JSONParser,
  TokenParserError,
  TokenizerError,
  TokenType,
} from '@streamparser/json';

export type BackupRecordSection = 'coffeeBeans' | 'brewingNotes';
export type BackupStreamEvent =
  | { section: BackupRecordSection; value: Record<string, unknown> }
  | { section: 'document'; value: { data: Record<string, unknown> } };

const CHUNK_BYTES = 64 * 1024;
const MAX_RECORD_BYTES = 32 * 1024 * 1024;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Replayable Blob slices provide backpressure without buffering the whole backup. */
export async function* readBackupStream(
  file: Blob,
  onProgress?: (fraction: number) => void
): AsyncGenerator<BackupStreamEvent> {
  const parser = new JSONParser({ stringBufferSize: CHUNK_BYTES });
  let queue: BackupStreamEvent[] = [];
  let tokenOffset = 0;
  let boundary = 0;
  let depth = 0;
  let complete = false;
  const sections = new Set<string>();
  const rootKeys = new Set<string>();
  const ids = {
    coffeeBeans: new Set<string>(),
    brewingNotes: new Set<string>(),
  };
  parser.onToken = ({ token, offset }) => {
    tokenOffset = offset;
    if (token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET) {
      if (++depth > 64) throw new Error('备份嵌套层级过多，无法安全导入');
    } else if (
      token === TokenType.RIGHT_BRACE ||
      token === TokenType.RIGHT_BRACKET
    ) {
      depth--;
    }
  };
  parser.onValue = ({ value, key, parent, stack }) => {
    if (stack.length === 1) {
      if (rootKeys.has(String(key))) throw new Error('备份包含重复的顶层字段');
      rootKeys.add(String(key));
    }
    const section = stack[1]?.key === 'data' ? stack[2]?.key : undefined;
    const streamed = section === 'coffeeBeans' || section === 'brewingNotes';
    if (streamed && stack.length === 3) {
      if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim())
        throw new Error(`${section} 中存在缺少有效 id 的记录`);
      if (ids[section].has(value.id))
        throw new Error(`${section} 中存在重复 id`);
      ids[section].add(value.id);
      queue.push({ section, value });
      // The parser owns the array; remove completed payloads before reading more bytes.
      if (Array.isArray(parent)) parent.length = 0;
      boundary = tokenOffset + 1;
    }
    if (stack.length === 2 && stack[1]?.key === 'data') {
      if (sections.has(String(key))) throw new Error('备份包含重复的数据分区');
      sections.add(String(key));
      if (
        (key === 'coffeeBeans' || key === 'brewingNotes') &&
        !Array.isArray(value)
      )
        throw new Error(`${key} 格式无效，应为数组`);
    }
    if (stack.length === 0) {
      if (!isRecord(value) || !isRecord(value.data))
        throw new Error('导入的数据格式不正确，缺少有效的 data 字段');
      complete = true;
      queue.push({
        section: 'document',
        value: value as { data: Record<string, unknown> },
      });
    }
  };
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    const end = Math.min(offset + CHUNK_BYTES, file.size);
    if (end - boundary > MAX_RECORD_BYTES)
      throw new Error('备份中单条记录超过 32 MB，请缩小该记录的图片后重试');
    const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    try {
      parser.write(chunk);
    } catch (error) {
      if (error instanceof TokenizerError || error instanceof TokenParserError)
        throw new Error('备份文件格式无效或不完整，请重新选择完整的备份', {
          cause: error,
        });
      throw error;
    }
    for (const event of queue) yield event;
    queue = [];
    onProgress?.(end / file.size);
  }
  if (!parser.isEnded) {
    try {
      parser.end();
    } catch (error) {
      throw new Error('备份文件格式无效或不完整，请重新选择完整的备份', {
        cause: error,
      });
    }
  }
  if (!complete) throw new Error('备份文件不完整，请重新选择完整的备份');
}
