import fs from 'node:fs'
import path from 'node:path'

export interface RotatingStreamOptions {
  dir: string
  baseName: string
  retentionDays?: number
}

function toDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export class DailyRotatingFileStream {
  private currentDateKey: string
  private currentStream: fs.WriteStream
  private readonly retentionDays: number

  constructor(private readonly options: RotatingStreamOptions) {
    this.retentionDays = options.retentionDays ?? 7
    fs.mkdirSync(options.dir, { recursive: true })
    this.currentDateKey = toDateKey()
    this.currentStream = this.openStream(this.currentDateKey)
    this.cleanupOldFiles()
  }

  write(chunk: string): boolean {
    const nowKey = toDateKey()
    if (nowKey !== this.currentDateKey) {
      this.rotate(nowKey)
    }
    return this.currentStream.write(chunk)
  }

  end(): void {
    this.currentStream.end()
  }

  private filePathFor(dateKey: string): string {
    return path.join(this.options.dir, `${this.options.baseName}-${dateKey}.log`)
  }

  private openStream(dateKey: string): fs.WriteStream {
    return fs.createWriteStream(this.filePathFor(dateKey), { flags: 'a', encoding: 'utf8' })
  }

  private rotate(nextDateKey: string): void {
    this.currentStream.end()
    this.currentDateKey = nextDateKey
    this.currentStream = this.openStream(nextDateKey)
    this.cleanupOldFiles()
  }

  private cleanupOldFiles(): void {
    const prefix = `${this.options.baseName}-`
    const suffix = '.log'
    const files = fs.readdirSync(this.options.dir)
      .filter((f) => f.startsWith(prefix) && f.endsWith(suffix))
      .sort()

    const keep = Math.max(1, this.retentionDays)
    const removeCount = Math.max(0, files.length - keep)
    for (let i = 0; i < removeCount; i++) {
      const fp = path.join(this.options.dir, files[i])
      try {
        fs.unlinkSync(fp)
      } catch {
        // ignore cleanup failure
      }
    }
  }
}
