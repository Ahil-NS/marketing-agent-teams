import {readFile, writeFile, mkdir, access} from 'node:fs/promises'
import {join, dirname} from 'node:path'

const CONTEXT_FILENAME = 'product-marketing-context.md'
const CONTEXT_DIR = 'context'

/**
 * Manages the persistent product marketing context stored at
 * .mat/context/product-marketing-context.md
 */
export class ContextManager {
  private readonly contextPath: string

  constructor(projectRoot: string) {
    this.contextPath = join(projectRoot, '.mat', CONTEXT_DIR, CONTEXT_FILENAME)
  }

  /**
   * Check if a product marketing context exists.
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.contextPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Read the product marketing context.
   * Returns null if no context file exists.
   */
  async getContext(): Promise<string | null> {
    try {
      return await readFile(this.contextPath, 'utf-8')
    } catch {
      return null
    }
  }

  /**
   * Write or overwrite the product marketing context.
   */
  async saveContext(content: string): Promise<void> {
    await mkdir(dirname(this.contextPath), {recursive: true})
    await writeFile(this.contextPath, content, 'utf-8')
  }

  /**
   * Returns the file path for display or editor opening.
   */
  getContextPath(): string {
    return this.contextPath
  }
}
