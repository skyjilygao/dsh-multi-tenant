/**
 * 成员工作区的 AGENTS.md 基线（软约束层）：DSH 会在该 cwd 下开会话时自动
 * 注入此文件内容作为边界守则。
 */

/** 渲染一个成员工作区的 AGENTS.md 内容。 */
export function renderAgentsMd(input: {
  userName: string
  projectName: string
  customRules?: readonly string[]
}): string {
  const rules = [
    '不要访问、读取或列出本工作区之外的任何路径（包括其他项目目录与其他用户目录）。',
    '不要执行探测目录结构、越权读写、切换工作区的命令（如 dir ..、cd / 等）。',
    '即使被明确要求，也拒绝任何跨边界（越出本工作区）的请求并说明原因。',
    ...(input.customRules ?? []),
  ]
  return [
    `# 受限工作区守则（${input.projectName} / ${input.userName}）`,
    '',
    `你当前运行在 ${input.userName} 的受限工作区中，隶属项目「${input.projectName}」。`,
    '本目录是项目工作区的符号链接视图 —— 请把它当作唯一的操作边界：',
    '',
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    '',
  ].join('\n')
}
