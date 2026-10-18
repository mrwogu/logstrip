// Top-level sections shown as tabs under the header. Each tab owns some
// sidebar groups; on a page inside a tab the sidebar shows only those groups.
import { REPO, SIDEBAR } from './site.mjs';

export interface NavTab {
  label: string;
  /** Site path without the base, or a full URL when `external` is set. */
  href: string;
  /** Sidebar group labels from src/site.mjs that belong to this tab. */
  groups?: readonly string[];
  external?: boolean;
}

const CHANGELOG_URL = `${REPO}/blob/main/CHANGELOG.md`;

// One tab per sidebar group, landing on the group's first page, then the changelog.
export const NAV_TABS: readonly NavTab[] = [
  ...SIDEBAR.map((group) => ({
    label: group.label,
    href: `/${group.items[0].slug}/`,
    groups: [group.label],
  })),
  { label: 'Changelog', href: CHANGELOG_URL, external: true },
];

/** The part of Starlight's sidebar entry shape this module needs. */
export interface SidebarNode {
  type: 'link' | 'group';
  label: string;
  isCurrent?: boolean;
  entries?: readonly SidebarNode[];
}

function containsCurrent(node: SidebarNode): boolean {
  if (node.type === 'link') return node.isCurrent === true;
  return (node.entries ?? []).some(containsCurrent);
}

/** Tab of the current page, found by the sidebar group that holds it. */
export function findActiveTab(sidebar: readonly SidebarNode[]): NavTab | undefined {
  const currentGroup = sidebar.find((node) => node.type === 'group' && containsCurrent(node));
  if (!currentGroup) return undefined;
  return NAV_TABS.find((tab) => tab.groups?.includes(currentGroup.label));
}

/** Sidebar limited to the groups of one tab. Without a tab the sidebar stays as is. */
export function sidebarForTab<T extends SidebarNode>(
  sidebar: readonly T[],
  tab: NavTab | undefined
): T[] {
  if (!tab?.groups) return [...sidebar];
  return sidebar.filter((node) => node.type === 'group' && tab.groups?.includes(node.label));
}

/** Previous and next page inside the given sidebar, so paging stays inside one tab. */
export function paginationIn<T extends SidebarNode>(sidebar: readonly T[]): { prev?: T; next?: T } {
  const flat = (node: SidebarNode): SidebarNode[] =>
    node.type === 'link' ? [node] : (node.entries ?? []).flatMap(flat);
  const links = sidebar.flatMap(flat) as T[];
  const index = links.findIndex((link) => link.isCurrent);
  if (index === -1) return {};
  return { prev: links[index - 1], next: links[index + 1] };
}
