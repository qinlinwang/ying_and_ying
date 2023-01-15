import { ref } from 'vue'
import { ceil, floor, random, shuffle } from 'lodash-es'
const defaultGameConfig: GameConfig = {
  cardNum: 4,
  layerNum: 2,
  trap: true,
  delNode: false,
}

export function useGame(config: GameConfig): Game {
  // 这里利用展开运算符，config里的属性会覆盖defaultGameConfig中的属性
  const { container, delNode, events = {}, ...initConfig } = { ...defaultGameConfig, ...config }
  const histroyList = ref<CardNode[]>([])
  const backFlag = ref(false)
  const removeFlag = ref(false)
  const removeList = ref<CardNode[]>([])
  const preNode = ref<CardNode | null>(null)
  /**
   * 存放所有的node
   */
  const nodes = ref<CardNode[]>([])
  const indexSet = new Set()
  let preFloorNodes: CardNode[] = []
  const selectedNodes = ref<CardNode[]>([])
  const size = 40
  let floorList: number[][] = []

  function updateState() {
    nodes.value.forEach((o) => {
      o.state = o.parents.every(p => p.state > 0) ? 1 : 0
    })
  }

  /**
   * 选中了一个节点
   * - 从可选节点中删除
   * - 判断是否有可消除的节点
   * - 添加到槽位中
   * @param node 
   * @returns 
   */
  function handleSelect(node: CardNode) {
    if (selectedNodes.value.length === 7) // 槽位已经满了，按理不应该出现这种情况
      return
    node.state = 2
    histroyList.value.push(node)
    preNode.value = node
    // 从待选的列表中删除
    const index = nodes.value.findIndex(o => o.id === node.id)
    if (index > -1)
      delNode && nodes.value.splice(index, 1)

    // 判断是否有可以消除的节点
    const selectedSomeNode = selectedNodes.value.filter(s => s.type === node.type)
    if (selectedSomeNode.length === 2) {
      // 第二个节点索引
      const secondIndex = selectedNodes.value.findIndex(o => o.id === selectedSomeNode[1].id)
      // 先把选中的节点插进去，这里可以优化
      selectedNodes.value.splice(secondIndex + 1, 0, node)
      // 为了动画效果添加延迟
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          // const index = selectedNodes.value.findIndex(o => o.type === node.type)
          selectedNodes.value.splice(secondIndex - 1, 1)
        }
        preNode.value = null
        // 判断是否已经清空节点，即是否胜利
        if (delNode ? nodes.value.length === 0 : nodes.value.every(o => o.state > 0) && removeList.value.length === 0 && selectedNodes.value.length === 0) {
          removeFlag.value = true
          backFlag.value = true
          events.winCallback && events.winCallback()
        }
        else {
          events.dropCallback && events.dropCallback()
        }
      }, 100)
    } else {
      events.clickCallback && events.clickCallback()
      const index = selectedNodes.value.findIndex(o => o.type === node.type)
      if (index > -1) // 有一个相同节点
        selectedNodes.value.splice(index + 1, 0, node)
      else // 没有相同的节点，就加到最后
        selectedNodes.value.push(node)
      // 判断卡槽是否已满，即失败
      if (selectedNodes.value.length === 7) {
        removeFlag.value = true
        backFlag.value = true
        events.loseCallback && events.loseCallback()
      }
    }
  }

  function handleSelectRemove(node: CardNode) {
    const index = removeList.value.findIndex(o => o.id === node.id)
    if (index > -1)
      removeList.value.splice(index, 1)
    handleSelect(node)
  }

  function handleBack() {
    const node = preNode.value
    if (!node)
      return
    preNode.value = null
    backFlag.value = true
    node.state = 0
    delNode && nodes.value.push(node)
    const index = selectedNodes.value.findIndex(o => o.id === node.id)
    selectedNodes.value.splice(index, 1)
  }

  function handleRemove() {
  // 从selectedNodes.value中取出3个 到 removeList.value中

    if (selectedNodes.value.length < 3)
      return
    removeFlag.value = true
    preNode.value = null
    for (let i = 0; i < 3; i++) {
      const node = selectedNodes.value.shift()
      if (!node)
        return
      removeList.value.push(node)
    }
  }

  function initData(config?: GameConfig | null) {
    const { cardNum, layerNum, trap } = { ...initConfig, ...config }
    histroyList.value = []
    backFlag.value = false
    removeFlag.value = false
    removeList.value = []
    preNode.value = null
    nodes.value = []
    indexSet.clear()
    preFloorNodes = []
    selectedNodes.value = []
    floorList = []
    const isTrap = trap && floor(random(0, 100)) !== 50

    // 生成节点池
    const itemTypes = (new Array(cardNum).fill(0)).map((_, index) => index + 1)
    console.log(itemTypes);
    let itemList: number[] = []
    // 每个节点要有3张牌，所以要乘以3
    for (let i = 0; i < 3 * layerNum; i++)
      itemList = [...itemList, ...itemTypes]

    if (isTrap) {
      // 如果有trap，那么把最后几张牌删除，这样就有可能不全了
      const len = itemList.length
      itemList.splice(len - cardNum, len)
    }
    // 打乱节点
    itemList = shuffle(shuffle(itemList))
    console.log(`打乱后的节点是：${itemList}`)

    // 初始化各个层级节点
    let len = 0
    let floorIndex = 1
    const itemLength = itemList.length
    // 把卡片列表itemList进行分割，并把分割后的片段装进floorList，每个片段代表一层
    // 每次分割，最多放楼层平方数量的的卡片，卡片分布在边长为楼层的正方形的上
    while (len <= itemLength) {
      const maxFloorNum = floorIndex * floorIndex
      const floorNum = ceil(random(maxFloorNum / 2, maxFloorNum))
      floorList.push(itemList.splice(0, floorNum))
      len += floorNum
      floorIndex++
    }
    (window as any).aa = container;
    const containerWidth = container.value!.clientWidth
    const containerHeight = container.value!.clientHeight
    const width = containerWidth / 2
    const height = containerHeight / 2 - 60

    // 对每个楼层进行加工
    floorList.forEach((o, index) => {
      // o是楼层卡片的数组，数组元素的数字代表卡片的类型
      // index+1 是楼层索引
      indexSet.clear()
      let i = 0
      const floorNodes: CardNode[] = []
      o.forEach((k) => {
        i = floor(random(0, (index + 1) ** 2))
        while (indexSet.has(i)) // 一直找到一个不包含的i
          i = floor(random(0, (index + 1) ** 2))
        // 行多，列少，会重复吗？
        const row = floor(i / (index + 1)) // 计算出卡片在楼层区域的行
        const column = index ? i % index : 0 // 计算出卡片在楼层区域的列
        console.log(`楼层是：${index},图层中索引是：${i},${index ? i % index : 0}:${i%(index+1)}`)
        const node: CardNode = {
          id: `${index}-${i}`,
          type: k,
          zIndex: index,
          index: i,
          row,
          column,
          top: height + (size * row - (size / 2) * index),
          left: width + (size * column - (size / 2) * index),
          parents: [],
          state: 0,
        }
        // 计算当前的node覆盖了谁
        const xy = [node.top, node.left]
        preFloorNodes.forEach((e) => {
          if (Math.abs(e.top - xy[0]) <= size && Math.abs(e.left - xy[1]) <= size)
            e.parents.push(node)
        })
        floorNodes.push(node)
        indexSet.add(i)
      })
      nodes.value = nodes.value.concat(floorNodes)
      preFloorNodes = floorNodes
    })

    updateState()
  }

  return {
    /**
     * 所有node
     */
    nodes,
    selectedNodes,
    removeFlag,
    removeList,
    backFlag,
    handleSelect,
    handleBack,
    handleRemove,
    handleSelectRemove,
    initData,
  }
}
