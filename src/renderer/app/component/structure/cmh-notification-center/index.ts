import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useNotificationStore } from '../../../store/notification.store'
import CmhNotificationCenterItem from './cmh-notification-center-item/index'
import template from './cmh-notification-center.html?raw'
import './cmh-notification-center.scss'

export default defineComponent({
  name: 'cmh-notification-center',
  template,
  components: {
    CmhNotificationCenterItem,
  },

  setup() {
    const isOpen = ref(false)
    const rootRef = ref<HTMLElement | null>(null)
    const notificationStore = useNotificationStore()

    const notifications = computed(() => [...notificationStore.notifications].reverse())
    const hasUnread = computed(() => notifications.value.some((item) => !item.visited))

    function openPanel(): void {
      isOpen.value = true
    }

    function closePanel(): void {
      if (!isOpen.value) {
        return
      }

      isOpen.value = false
      notificationStore.markAllNotificationsVisited()
    }

    function toggleOpen(): void {
      if (isOpen.value) {
        closePanel()
        return
      }

      openPanel()
    }

    function clearAllNotifications(): void {
      notificationStore.clearAll()
      closePanel()
    }

    function handleDocumentClick(event: MouseEvent): void {
      if (!isOpen.value || !rootRef.value) {
        return
      }

      const target = event.target

      if (target instanceof Node && !rootRef.value.contains(target)) {
        closePanel()
      }
    }

    onMounted(() => {
      document.addEventListener('mousedown', handleDocumentClick)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', handleDocumentClick)
    })

    return {
      isOpen,
      rootRef,
      notifications,
      hasUnread,
      toggleOpen,
      closePanel,
      clearAllNotifications,
    }
  },
})
