/**
 * CMH Chatbot Settings Factory
 *
 * 설정 항목을 그룹별로 관리하는 팩토리.
 */
import type { SettingsItem } from './module.factory'

const settingsRegistry = new Map<string, SettingsItem[]>()

function addItem(item: SettingsItem): void {
  const group = item.group
  if (!settingsRegistry.has(group)) {
    settingsRegistry.set(group, [])
  }
  settingsRegistry.get(group)!.push(item)
}

function getItemsByGroup(group: string): SettingsItem[] {
  return settingsRegistry.get(group) ?? []
}

function getAllGroups(): string[] {
  return [...settingsRegistry.keys()]
}

function getAllItems(): SettingsItem[] {
  const items: SettingsItem[] = []
  for (const group of settingsRegistry.values()) {
    items.push(...group)
  }
  return items
}

const SettingsFactory = {
  addItem,
  getItemsByGroup,
  getAllGroups,
  getAllItems,
}

export default SettingsFactory
