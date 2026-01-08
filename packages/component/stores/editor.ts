/**
 * 编辑器状态管理
 */

import { defineStore } from 'pinia';
import type { Panel, ID } from '@/types';
import { deepClone } from '@/utils';

interface EditorState {
  /** 抽屉是否打开 */
  isDrawerOpen: boolean;
  /** 编辑中的面板 */
  editingPanel: Panel | null;
  /** 编辑模式：创建或编辑 */
  editingMode: 'create' | 'edit';
  /** 目标面板组 ID */
  targetGroupId: ID | null;
  /** 原始面板 ID（编辑模式） */
  originalPanelId?: ID;
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    isDrawerOpen: false,
    editingPanel: null,
    editingMode: 'create',
    targetGroupId: null,
    originalPanelId: undefined,
  }),

  actions: {
    /**
     * 打开编辑器（创建模式）
     */
    openCreateEditor(groupId: ID, defaultPanel?: Partial<Panel>) {
      this.editingMode = 'create';
      this.targetGroupId = groupId;
      this.editingPanel = {
        id: '', // 将在保存时生成
        name: '',
        type: 'timeseries' as any,
        queries: [],
        options: {},
        ...defaultPanel,
      } as Panel;
      this.isDrawerOpen = true;
    },

    /**
     * 打开编辑器（编辑模式）
     */
    openEditEditor(groupId: ID, panel: Panel) {
      this.editingMode = 'edit';
      this.targetGroupId = groupId;
      this.originalPanelId = panel.id;
      this.editingPanel = deepClone(panel);
      this.isDrawerOpen = true;
    },

    /**
     * 关闭编辑器
     */
    closeEditor() {
      this.isDrawerOpen = false;
      this.editingPanel = null;
      this.targetGroupId = null;
      this.originalPanelId = undefined;
    },

    /**
     * 更新编辑中的面板
     */
    updateEditingPanel(updates: Partial<Panel>) {
      if (this.editingPanel) {
        this.editingPanel = {
          ...this.editingPanel,
          ...updates,
        };
      }
    },
  },
});
