/**
 * CMH Mixin Factory
 *
 * Mixin.register('notification', mixinObj) → Mixin.getByName('notification')
 * AideWorks mixin.factory 패턴 이식.
 */

type MixinObject = Record<string, any>

const mixinRegistry = new Map<string, MixinObject>()

const MixinFactory = {
  register(name: string, mixin: MixinObject): MixinObject {
    if (mixinRegistry.has(name)) {
      console.warn(`[MixinFactory] Mixin "${name}" already registered. Overwriting.`)
    }
    mixinRegistry.set(name, mixin)
    return mixin
  },

  getByName(name: string): MixinObject {
    const mixin = mixinRegistry.get(name)
    if (!mixin) {
      throw new Error(`[MixinFactory] Mixin "${name}" is not registered.`)
    }
    return mixin
  },

  getRegistry(): Map<string, MixinObject> {
    return mixinRegistry
  },

  has(name: string): boolean {
    return mixinRegistry.has(name)
  },
}

export { MixinFactory }
export default MixinFactory
