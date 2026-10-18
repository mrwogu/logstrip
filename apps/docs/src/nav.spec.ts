import { describe, expect, it } from 'vitest';
import { NAV_TABS, findActiveTab, paginationIn, sidebarForTab, type SidebarNode } from './nav';
import { SIDEBAR } from './site.mjs';

function sidebar(currentLabel?: string): SidebarNode[] {
  const link = (label: string): SidebarNode => ({
    type: 'link',
    label,
    isCurrent: label === currentLabel,
  });
  return [
    {
      type: 'group',
      label: 'Start',
      entries: [link('Getting Started'), link('Supported Sources')],
    },
    {
      type: 'group',
      label: 'Reference',
      entries: [link('CLI'), { type: 'group', label: 'Nested', entries: [link('Core API')] }],
    },
    { type: 'group', label: 'Examples', entries: [link('Cookbook')] },
  ];
}

describe('findActiveTab', () => {
  it('finds the tab of the group holding the current page, also in nested groups', () => {
    expect(findActiveTab(sidebar('Supported Sources'))?.label).toBe('Get Started');
    expect(findActiveTab(sidebar('Core API'))?.label).toBe('Reference');
  });

  it('finds no tab when the current page is in no group', () => {
    expect(findActiveTab(sidebar())).toBeUndefined();
  });
});

describe('sidebarForTab', () => {
  it('keeps only the groups of the tab', () => {
    const tab = NAV_TABS.find((item) => item.label === 'Reference');

    const labels = sidebarForTab(sidebar('CLI'), tab).map((node) => node.label);

    expect(labels).toEqual(['Reference']);
  });

  it('keeps the whole sidebar without a tab', () => {
    expect(sidebarForTab(sidebar(), undefined)).toHaveLength(3);
  });
});

describe('NAV_TABS', () => {
  it('assigns each sidebar group to exactly one tab', () => {
    const groups = NAV_TABS.flatMap((tab) => tab.groups ?? []);

    expect(new Set(groups).size).toBe(groups.length);
    expect([...groups].sort()).toEqual(SIDEBAR.map((group) => group.label).sort());
  });
});

describe('paginationIn', () => {
  it('links the pages around the current one, also across nested groups', () => {
    const { prev, next } = paginationIn(sidebar('CLI'));

    expect(prev?.label).toBe('Supported Sources');
    expect(next?.label).toBe('Core API');
  });

  it('has no previous page on the first link and nothing without a current page', () => {
    expect(paginationIn(sidebar('Getting Started')).prev).toBeUndefined();
    expect(paginationIn(sidebar())).toEqual({});
  });
});
