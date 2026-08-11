// eslint-disable-next-line @typescript-eslint/no-require-imports
const Snowflake = require('snowflake-id').default || require('snowflake-id');

const snowflake = new Snowflake({
  mid: 42,
});

/**
 * 生成全局唯一的雪花算法字符串 ID
 */
export function nextSnowflakeId(): string {
  return String(snowflake.generate());
}
