import { defineComponent } from 'vue'
import { useRepositoryFactory } from '../../../../app/composables/useRepositoryFactory'
import template from './cmh-media-index.html?raw'
import './cmh-media-index.scss'

interface MediaRecord extends Record<string, unknown> {
  id: string
  fileName: string
  fileExtension: string
  mimeType: string
  fileSize: number
  title: string | null
  alt: string | null
  path: string
  hash: string | null
  tags: string
  folderId: string | null
  createdAt: string
  updatedAt: string | null
}

interface FolderRecord extends Record<string, unknown> {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

type SortOption = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'date-asc' | 'date-desc'
type Presentation = 'grid-normal' | 'grid-large' | 'list'

/**
 * cmh-media-index — 미디어 라이브러리 메인 페이지
 * Migrated from aideworks aw-media-index.
 * No Shopware alphabet subfolder sharding.
 */
export default defineComponent({
  name: 'cmh-media-index',
  template,

  data() {
    const { repositoryFactory } = useRepositoryFactory()
    return {
      isLoading: false,
      isUploading: false,
      folders: [] as FolderRecord[],
      items: [] as MediaRecord[],
      selectedFolder: null as FolderRecord | null,
      selectedMedia: null as MediaRecord | null,
      /* Upload modal */
      showUrlUpload: false,
      urlToUpload: '',
      isUrlUploading: false,
      /* Folder create modal */
      showFolderModal: false,
      newFolderName: '',
      isCreatingFolder: false,
      /* Media edit modal */
      showEditModal: false,
      editMediaItem: null as MediaRecord | null,
      editTitle: '',
      editAlt: '',
      isSavingEdit: false,
      /* Sort/Display */
      sortOption: 'name-asc' as SortOption,
      presentation: 'grid-normal' as Presentation,
      /* DAL */
      repositoryFactory,
      searchTerm: '',
    }
  },

  computed: {
    sortField(): string {
      return this.sortOption.split('-')[0]
    },
    sortOrder(): string {
      return this.sortOption.split('-')[1]
    },

    sortedItems(): MediaRecord[] {
      let list = [...this.items]
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase()
        list = list.filter(
          (item) =>
            item.fileName.toLowerCase().includes(term) ||
            (item.title && item.title.toLowerCase().includes(term)),
        )
      }
      const field = this.sortField
      const desc = this.sortOrder === 'desc'
      list.sort((a, b) => {
        let cmp = 0
        if (field === 'name') cmp = a.fileName.localeCompare(b.fileName)
        else if (field === 'size') cmp = a.fileSize - b.fileSize
        else if (field === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        return desc ? -cmp : cmp
      })
      return list
    },

    sortedFolders(): FolderRecord[] {
      if (this.sortField !== 'name') return this.folders
      const desc = this.sortOrder === 'desc'
      return [...this.folders].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name)
        return desc ? -cmp : cmp
      })
    },

    hasItems(): boolean {
      return this.sortedItems.length > 0 || this.folders.length > 0
    },

    currentFolderId(): string | null {
      return (this.$route?.params?.folderId as string) || null
    },

    isInSubfolder(): boolean {
      return this.currentFolderId !== null
    },
  },

  watch: {
    '$route.params.folderId'(): void {
      this.selectedFolder = null
      this.selectedMedia = null
      void this.loadContent()
    },
  },

  created() {
    void this.createdComponent()
  },

  methods: {
    async createdComponent(): Promise<void> {
      await this.loadContent()
    },

    async loadContent(): Promise<void> {
      this.isLoading = true
      try {
        await Promise.all([this.loadFolders(), this.loadMedia()])
      } finally {
        this.isLoading = false
      }
    },

    async loadMedia(): Promise<void> {
      const repository = this.repositoryFactory.create('cmh_media')
      const result = await repository.search({ limit: 500 })
      const parentId = this.currentFolderId
      this.items = parentId
        ? result.data.filter((m: MediaRecord) => m.folderId === parentId)
        : result.data.filter((m: MediaRecord) => !m.folderId)
    },

    async loadFolders(): Promise<void> {
      const repository = this.repositoryFactory.create('cmh_media_folder')
      const result = await repository.search({ limit: 500 })
      const parentId = this.currentFolderId
      this.folders = parentId
        ? result.data.filter((f: FolderRecord) => f.parentId === parentId)
        : result.data.filter((f: FolderRecord) => !f.parentId)
    },

    /* ── Navigation ─────────────────────────────────────── */

    enterFolder(folder: FolderRecord): void {
      this.selectedFolder = null
      this.selectedMedia = null
      void this.$router.push({ name: 'cmh.media.index', params: { folderId: folder.id } })
    },

    goToRoot(): void {
      void this.$router.push({ name: 'cmh.media.index', params: {} })
    },

    /* ── Selection ──────────────────────────────────────── */

    selectFolderItem(folder: FolderRecord): void {
      this.selectedMedia = null
      this.selectedFolder = this.selectedFolder?.id === folder.id ? null : folder
    },

    selectMedia(item: MediaRecord): void {
      this.selectedFolder = null
      this.selectedMedia = this.selectedMedia?.id === item.id ? null : item
    },

    clearSelection(): void {
      this.selectedMedia = null
      this.selectedFolder = null
    },

    /* ── Upload ─────────────────────────────────────────── */

    async onFileSelect(event: Event): Promise<void> {
      const input = event.target as HTMLInputElement
      if (!input.files?.length) return

      this.isUploading = true
      try {
        for (const file of Array.from(input.files)) {
          const buffer = await file.arrayBuffer()
          const mediaId = crypto.randomUUID()
          const ext = file.name.includes('.') ? file.name.split('.').pop()! : ''

          // Compute SHA-256 hash for deduplication
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

          // Store file as blob URL (renderer-only; host app should override with real storage)
          const blob = new Blob([buffer], { type: file.type })
          const path = URL.createObjectURL(blob)

          const repository = this.repositoryFactory.create('cmh_media')
          await repository.save({
            id: mediaId,
            fileName: file.name.replace(/\.[^.]+$/, ''),
            fileExtension: ext,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            title: null,
            alt: null,
            path,
            hash,
            folderId: this.currentFolderId,
            tags: '[]',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as MediaRecord)
        }
        await this.loadMedia()
      } finally {
        this.isUploading = false
        input.value = ''
      }
    },

    /* ── Media Edit Modal ───────────────────────────────── */

    openEditModal(id: string): void {
      const item = this.items.find((m) => m.id === id) ?? null
      if (!item) return
      this.editMediaItem = item
      this.editTitle = item.title ?? ''
      this.editAlt = item.alt ?? ''
      this.showEditModal = true
    },

    closeEditModal(): void {
      this.showEditModal = false
      this.editMediaItem = null
    },

    async saveEditMedia(): Promise<void> {
      if (!this.editMediaItem) return
      this.isSavingEdit = true
      try {
        const repository = this.repositoryFactory.create('cmh_media')
        await repository.save({
          ...this.editMediaItem,
          title: this.editTitle || null,
          alt: this.editAlt || null,
          updatedAt: new Date().toISOString(),
        } as MediaRecord)
        const idx = this.items.findIndex((m) => m.id === this.editMediaItem!.id)
        if (idx !== -1) {
          this.items[idx] = { ...this.items[idx], title: this.editTitle || null, alt: this.editAlt || null }
        }
        this.closeEditModal()
      } finally {
        this.isSavingEdit = false
      }
    },

    /* ── Delete ──────────────────────────────────────────── */

    async onMediaDelete(item: MediaRecord): Promise<void> {
      const repository = this.repositoryFactory.create('cmh_media')
      await repository.delete(item.id)
      // Also delete associated RAG documents
      const ragRepo = this.repositoryFactory.create('cmh_rag_document')
      const ragResult = await ragRepo.search({ limit: 1000 })
      const ragDocs = ragResult.data.filter((d: any) => d.mediaId === item.id)
      for (const doc of ragDocs) {
        await ragRepo.delete(doc.id)
      }
      this.clearSelection()
      await this.loadMedia()
    },

    async onFolderDelete(folder: FolderRecord): Promise<void> {
      const repository = this.repositoryFactory.create('cmh_media_folder')
      await repository.delete(folder.id)
      this.selectedFolder = null
      await this.loadContent()
    },

    /* ── Folder Create ──────────────────────────────────── */

    openFolderModal(): void {
      this.newFolderName = ''
      this.showFolderModal = true
    },

    closeFolderModal(): void {
      this.showFolderModal = false
    },

    async createFolder(): Promise<void> {
      const name = this.newFolderName.trim()
      if (!name) return
      this.isCreatingFolder = true
      try {
        const repository = this.repositoryFactory.create('cmh_media_folder')
        await repository.save({
          id: crypto.randomUUID(),
          name,
          parentId: this.currentFolderId,
          createdAt: new Date().toISOString(),
        } as FolderRecord)
        this.closeFolderModal()
        await this.loadFolders()
      } finally {
        this.isCreatingFolder = false
      }
    },

    /* ── URL Upload ─────────────────────────────────────── */

    openUrlUpload(): void {
      this.showUrlUpload = true
      this.urlToUpload = ''
    },

    closeUrlUpload(): void {
      this.showUrlUpload = false
    },

    async submitUrlUpload(): Promise<void> {
      const url = this.urlToUpload.trim()
      if (!url) return
      this.isUrlUploading = true
      try {
        const resp = await fetch(url)
        const buffer = await resp.arrayBuffer()
        const contentType = resp.headers.get('content-type') || 'application/octet-stream'
        const urlPath = url.split('?')[0]
        const urlFileName = urlPath.split('/').pop() || 'download'
        const ext = urlFileName.includes('.') ? urlFileName.split('.').pop()! : ''
        const fileName = urlFileName.replace(/\.[^.]+$/, '')

        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

        const blob = new Blob([buffer], { type: contentType })
        const path = URL.createObjectURL(blob)
        const mediaId = crypto.randomUUID()

        const repository = this.repositoryFactory.create('cmh_media')
        await repository.save({
          id: mediaId,
          fileName,
          fileExtension: ext,
          mimeType: contentType,
          fileSize: buffer.byteLength,
          title: null,
          alt: null,
          path,
          hash,
          folderId: this.currentFolderId,
          tags: '[]',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as MediaRecord)

        this.closeUrlUpload()
        await this.loadMedia()
      } finally {
        this.isUrlUploading = false
      }
    },

    /* ── Formatting helpers ──────────────────────────────── */

    formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
    },

    formatDate(dateStr: string): string {
      return new Date(dateStr).toLocaleDateString()
    },

    isImage(item: MediaRecord): boolean {
      return item.mimeType.startsWith('image/')
    },

    getIconForMime(mimeType: string): string {
      if (mimeType.startsWith('image/')) return 'ph:image'
      if (mimeType.startsWith('video/')) return 'ph:video'
      if (mimeType.startsWith('audio/')) return 'ph:speaker-high'
      if (mimeType.includes('pdf')) return 'ph:file-pdf'
      if (mimeType.includes('word') || mimeType.includes('document')) return 'ph:file-doc'
      if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'ph:file-xls'
      return 'ph:file'
    },
  },
})
