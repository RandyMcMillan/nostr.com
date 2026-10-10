export const GIT_REPO_KIND = 30617;
export const GIT_REPO_STATE_KIND = 30618;
export const NIP34_PATCH_KIND = 30619;
export const NIP34_ISSUE_KIND = 30620;
export const GIT_PATCH_KIND = 1617;
export const GIT_PR_KIND = 1618;
export const GIT_PR_UPDATE_KIND = 1619;
export const GIT_ISSUE_KIND = 1621;

export const GIT_STATUS_OPEN_KIND = 1630;
export const GIT_STATUS_APPLIED_KIND = 1631;
export const GIT_STATUS_CLOSED_KIND = 1632;
export const GIT_STATUS_DRAFT_KIND = 1633;
export const GIT_STATUS_KINDS = [GIT_STATUS_OPEN_KIND, GIT_STATUS_APPLIED_KIND, GIT_STATUS_CLOSED_KIND, GIT_STATUS_DRAFT_KIND];

export const GIT_GRASP_LIST_KIND = 10317;
export const COMMENT_KIND = 1111;

export const GIT_ROOT_KINDS = [GIT_REPO_KIND, GIT_REPO_STATE_KIND, GIT_PATCH_KIND, GIT_PR_KIND, GIT_ISSUE_KIND, NIP34_PATCH_KIND, NIP34_ISSUE_KIND];
export const GIT_THREAD_REPLY_KINDS = [COMMENT_KIND, ...GIT_STATUS_KINDS];

export function isGitRootKind(kind: number) {
  return GIT_ROOT_KINDS.includes(kind);
}

export function isGitStatusKind(kind: number) {
  return GIT_STATUS_KINDS.includes(kind);
}

export function isGitEvent(kind: number) {
  return isGitRootKind(kind) || isGitStatusKind(kind) || kind === GIT_GRASP_LIST_KIND;
}

export function isAddressableKind(kind: number) {
  return (kind >= 30000 && kind < 40000) || kind === GIT_GRASP_LIST_KIND;
}
