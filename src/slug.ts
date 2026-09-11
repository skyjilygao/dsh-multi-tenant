/**
 * 确定性的、路径安全的 slug：ASCII 字母数字保留（大写转小写），其余 ASCII
 * 连字符折叠；非 ASCII（如中文）按码点十六进制编码，保证 CJK 名称也能映射
 * 出稳定、合法的目录段。
 */

const HEX = (cp: number): string => cp.toString(16)

/** 任意显示名 → 可用作路径段的 slug。 */
export function slug(name: string): string {
  let out = ''
  let dash = false
  for (const ch of name) {
    const cp = ch.codePointAt(0)!
    if ((cp >= 0x61 && cp <= 0x7a) || (cp >= 0x30 && cp <= 0x39)) {
      out += dash ? '-' + ch : ch
      dash = false
    } else if (cp >= 0x41 && cp <= 0x5a) {
      out += dash ? '-' + ch.toLowerCase() : ch.toLowerCase()
      dash = false
    } else if (cp > 0x7f) {
      out += dash ? '-' + HEX(cp) : HEX(cp)
      dash = false
    } else {
      dash = out.length > 0
    }
  }
  return out.length > 0 ? out : 'x'
}

/** 是否已是规范 slug。 */
export function isSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(s)
}
