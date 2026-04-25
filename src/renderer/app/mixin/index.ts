/**
 * AideWorks Mixin Index
 *
 * Shopware 패턴: Mixin.register() → Mixin.getByName() 으로 접근.
 *
 * Usage (Shopware const destructuring):
 * ```ts
 * import AideWorks from '@shared/aideworks'
 * const { Mixin } = AideWorks
 *
 * export default defineComponent({
 *   mixins: [Mixin.getByName('notification'), Mixin.getByName('listing')],
 * })
 * ```
 */
import MixinFactory from '@core/factory/mixin.factory'
import NotificationMixin from './notification.mixin'
import ValidationMixin from './validation.mixin'
import ListingMixin from './listing.mixin'
import FormFieldMixin from './form-field.mixin'

// ── MixinFactory 에 등록 (Shopware Mixin.register 대응) ─────────
MixinFactory.register('notification', NotificationMixin)
MixinFactory.register('validation', ValidationMixin)
MixinFactory.register('listing', ListingMixin)
MixinFactory.register('form-field', FormFieldMixin)

const Mixins = {
    NotificationMixin,
    ValidationMixin,
    ListingMixin,
    FormFieldMixin,
} as const

export default Mixins
export { NotificationMixin, ValidationMixin, ListingMixin, FormFieldMixin }
