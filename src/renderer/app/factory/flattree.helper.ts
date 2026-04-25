/**
 * FlatTree — 계층 구조 메뉴를 flat 배열에서 트리로 변환
 * AideWorks FlatTree 포팅
 */

interface TreeNode {
  id: string
  parent?: string
  children: TreeNode[]
  level: number
  position?: number
  [key: string]: unknown
}

export class FlatTree<T extends TreeNode = TreeNode> {
  private items: T[] = []
  private comparator: (a: T, b: T) => number

  constructor(comparator?: (a: T, b: T) => number) {
    this.comparator = comparator ?? (() => 0)
  }

  add(item: T): void {
    this.items.push(item)
  }

  convertToTree(): T[] {
    const map = new Map<string, T>()
    const roots: T[] = []

    // 모든 아이템을 맵에 등록
    for (const item of this.items) {
      map.set(item.id, { ...item, children: [] as TreeNode[] } as T)
    }

    // 부모-자식 관계 구성
    for (const item of this.items) {
      const node = map.get(item.id)!
      if (item.parent && map.has(item.parent)) {
        const parent = map.get(item.parent)!
        node.level = (parent.level ?? 1) + 1
        parent.children.push(node)
      } else {
        node.level = 1
        roots.push(node)
      }
    }

    // 정렬
    const sortRecursive = (nodes: T[]): void => {
      nodes.sort(this.comparator)
      for (const node of nodes) {
        if (node.children.length > 0) {
          sortRecursive(node.children as T[])
        }
      }
    }
    sortRecursive(roots)

    return roots
  }
}
