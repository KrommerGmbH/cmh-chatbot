/**
 * @core/factory/module.factory — re-export
 *
 * 기존 app/factory/module.factory 를 @core 경로에서 접근 가능하도록 re-export.
 */
export {
  default,
  type ModuleManifest,
  type ModuleNavigation,
  type ModuleRoute,
  type NavigationEntryWithChildren,
  type SettingsItem,
} from '../../app/factory/module.factory'
