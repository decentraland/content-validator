import { BlockInfo, BlockRepository, createAvlBlockSearch, metricsDefinitions } from '@dcl/block-indexer'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { L1Checker, L2Checker, OnChainAccessCheckerComponents, ThirdPartyItemChecker, ValidateFn } from '../../../src'
import { createEmoteValidateFn, createWearableValidateFn } from '../../../src/validations/access/common/items'
import { createOnChainClient } from '../../../src/validations/access/on-chain/client'
import { createV1andV2collectionAssetValidateFn } from '../../../src/validations/access/on-chain/collection-asset'
import { createThirdPartyAssetValidateFn } from '../../../src/validations/access/on-chain/third-party-asset'
import { buildComponents, createMockItemCheckerComponent, createMockSubgraphComponent } from '../../setup/mock'

const defaultEthereum = [
  {
    urn: 'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet'
  }
]

const defaultMatic = [
  {
    urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa4:0'
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:19'
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:2'
  }
]

export function createCollectionsSubgraph(items: { urn: string }[]) {
  return createMockSubgraphComponent(
    jest.fn().mockResolvedValue({
      items
    })
  )
}

export function createDefaultCollectionsL1Subgraph() {
  return createCollectionsSubgraph(defaultEthereum)
}

export function createDefaultCollectionsL2Subgraph() {
  return createCollectionsSubgraph(defaultMatic)
}

export function createMockL1Checker(): L1Checker {
  return {
    checkLAND: jest.fn(),
    checkNames: jest.fn((_ethAddress, names) => Promise.resolve(names.map(() => false)))
  }
}

export function createMockThirdPartyItemCheckerComponent(): ThirdPartyItemChecker {
  return {
    checkThirdPartyItems: jest.fn()
  }
}

export function createMockL2Checker(): L2Checker {
  return {
    validateWearables: jest.fn(),
    validateThirdParty: jest.fn()
  }
}
export function createMockBlockRepository(currentBlock: number, blocks: Record<number, number>) {
  const blockRepository: BlockRepository = {
    currentBlock(): Promise<BlockInfo> {
      return Promise.resolve({
        block: currentBlock,
        timestamp: blocks[currentBlock]
      })
    },
    findBlock(block: number): Promise<BlockInfo> {
      if (block in blocks) {
        return Promise.resolve({
          block,
          timestamp: blocks[block]
        })
      }
      throw Error(`Block ${block} could not be retrieved.`)
    }
  }
  return blockRepository
}

export const buildOnChainAccessCheckerComponents = (
  provided?: Partial<OnChainAccessCheckerComponents>
): OnChainAccessCheckerComponents => {
  const basicComponents = buildComponents(provided)
  const { logs } = basicComponents

  const metrics = createTestMetricsComponent(metricsDefinitions)
  const L1 = provided?.L1 ?? {
    checker: createMockL1Checker(),
    thirdParty: createMockThirdPartyItemCheckerComponent(),
    collections: createMockItemCheckerComponent(),
    blockSearch: createAvlBlockSearch({
      logs,
      metrics,
      blockRepository: createMockBlockRepository(10, {
        1: 10,
        2: 20,
        3: 30,
        4: 40,
        5: 50,
        6: 60,
        7: 70,
        8: 80,
        9: 90,
        10: 100,
        11: 110
      })
    })
  }
  const L2 = provided?.L2 ?? {
    checker: createMockL2Checker(),
    thirdParty: createMockThirdPartyItemCheckerComponent(),
    collections: createMockItemCheckerComponent(),
    blockSearch: createAvlBlockSearch({
      logs,
      metrics,
      blockRepository: createMockBlockRepository(10, {
        1: 10,
        2: 20,
        3: 30,
        4: 40,
        5: 50,
        6: 60,
        7: 70,
        8: 80,
        9: 90,
        10: 100,
        11: 110
      })
    })
  }

  const client = provided?.client ?? createOnChainClient({ logs, L1, L2 })

  return {
    ...basicComponents,
    L1,
    L2,
    client
  }
}

export function buildWearableValidateFn(components: OnChainAccessCheckerComponents): ValidateFn {
  const thirdPartyAssetValidateFn = createThirdPartyAssetValidateFn(components)
  const v1andV2collectionAssetValidateFn = createV1andV2collectionAssetValidateFn(components)

  return createWearableValidateFn(components, v1andV2collectionAssetValidateFn, thirdPartyAssetValidateFn)
}

export function buildEmoteValidateFn(components: OnChainAccessCheckerComponents): ValidateFn {
  const thirdPartyAssetValidateFn = createThirdPartyAssetValidateFn(components)
  const v1andV2collectionAssetValidateFn = createV1andV2collectionAssetValidateFn(components)

  return createEmoteValidateFn(components, v1andV2collectionAssetValidateFn, thirdPartyAssetValidateFn)
}
