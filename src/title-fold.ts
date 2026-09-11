/**
 * 持久日志标题折叠（dsh-session-query 的 readTitleSnapshots 结果合并）。
 * 让冷会话（本次宿主生命周期内未打开过）的侧边栏行也带真实标题。
 */

/** 列表行最小形状。 */
export interface TitleFoldRow {
  id: string
  title?: string
}

/** readTitleSnapshots 结果条目的结构化子集。 */
export interface TitleFoldObservation {
  sessionId: string
  status: 'fulfilled' | 'rejected'
  value?: { title?: { title?: string } }
}

/** 把折叠出的持久标题合并进列表行；身份与顺序保持不变。 */
export function applyTitleFold<R extends TitleFoldRow>(
  rows: readonly R[],
  observations: readonly TitleFoldObservation[],
): R[] {
  const folded = new Map<string, string>()
  for (const observation of observations) {
    if (observation.status !== 'fulfilled') continue
    const title = observation.value?.title?.title
    if (typeof title === 'string' && title.length > 0) folded.set(observation.sessionId, title)
  }
  return rows.map((row) => {
    const title = folded.get(row.id)
    return title === undefined ? row : { ...row, title }
  })
}
