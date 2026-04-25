import { defineComponent } from 'vue'
import { useNotificationStore } from '../../../../store/notification.store'
import type { NotificationAction, NotificationItem } from '../../../../store/notification.store'
import template from './cmh-notification-center-item.html?raw'
import './cmh-notification-center-item.scss'

function formatRelativeTime(timestamp: Date): string {
  const locale = document.documentElement.lang || 'en-GB'
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (absMs < minute) {
    return rtf.format(Math.round(diffMs / 1000), 'second')
  }

  if (absMs < hour) {
    return rtf.format(Math.round(diffMs / minute), 'minute')
  }

  if (absMs < day) {
    return rtf.format(Math.round(diffMs / hour), 'hour')
  }

  return new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }).format(date)
}

export default defineComponent({
  name: 'cmh-notification-center-item',
  template,
  emits: ['center-close'],

  props: {
    notification: {
      type: Object as () => NotificationItem,
      required: true,
    },
  },

  computed: {
    itemHeaderClass(): Record<string, boolean> {
      return {
        'cmh-notification-center-item__header--is-new': !this.notification.visited,
      }
    },

    notificationActions(): NotificationAction[] {
      return (this.notification.actions ?? []).filter((action) => Boolean(action.route || action.method))
    },

    timestampLabel(): string {
      return formatRelativeTime(this.notification.timestamp)
    },
  },

  methods: {
    handleDelete(): void {
      useNotificationStore().removeNotification(this.notification.id)
    },

    handleAction(action: NotificationAction): void {
      if (action.route) {
        if (typeof action.route === 'string' && /^https?:\/\//.test(action.route)) {
          window.open(action.route, '_blank')
        } else {
          this.$router.push(action.route as never)
        }
      }

      if (action.method && typeof action.method === 'function') {
        action.method.call(null)
      }

      this.$emit('center-close')
    },
  },
})
