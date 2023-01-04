import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { createTheGraphClient } from '../../src'
import { ContentValidatorComponents, ExternalCalls, L1Checker, L2Checker, QueryGraph, SubGraphs } from '../../src/types'
import { ItemCollection } from '../../src/validations/access-checker/items/collection-asset'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { BlockInfo, BlockRepository, createAvlBlockSearch, metricsDefinitions } from '@dcl/block-indexer'
import { createTestMetricsComponent } from '@well-known-components/metrics'

export const buildLogger = (): ILoggerComponent => ({
  getLogger: () => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    log() {},
  }),
})

export function createMockL1Checker(): L1Checker {
  return {
    checkLAND: jest.fn(),
    checkNames: jest.fn((_ethAddress, names) => Promise.resolve(names.map(() => false))),
  }
}

export function createMockL2Checker(): L2Checker {
  return {
    validateWearables: jest.fn(),
    validateThirdParty: jest.fn(),
  }
}

export const buildComponents = (components?: Partial<ContentValidatorComponents>): ContentValidatorComponents => {
  const config = components?.config ?? buildConfig({})

  const externalCalls = components?.externalCalls ?? buildExternalCalls()

  const logs = components?.logs ?? buildLogger()

  const subGraphs = components?.subGraphs ?? buildSubGraphs()
  const theGraphClient = components?.theGraphClient ?? createTheGraphClient({ logs, subGraphs, ...components })

  return {
    config,
    logs,
    theGraphClient,
    externalCalls,
    subGraphs,
  }
}

export const buildConfig = (optionMap: Partial<Record<string, string>>): IConfigComponent =>
  createConfigComponent({ ...optionMap })

export const buildExternalCalls = (externalCalls?: Partial<ExternalCalls>): ExternalCalls => ({
  isContentStoredAlready: () => Promise.resolve(new Map()),
  fetchContentFileSize: () => Promise.resolve(undefined),
  validateSignature: () => Promise.resolve({ ok: true }),
  ownerAddress: () => '',
  isAddressOwnedByDecentraland: () => false,
  ...externalCalls,
})

export const createMockSubgraphComponent = (mock?: QueryGraph): ISubgraphComponent => ({
  query: mock ?? (jest.fn() as jest.MockedFunction<QueryGraph>),
})

export function createMockBlockRepository(currentBlock: number, blocks: Record<number, number>) {
  const blockRepository: BlockRepository = {
    currentBlock(): Promise<BlockInfo> {
      return Promise.resolve({
        block: currentBlock,
        timestamp: blocks[currentBlock],
      })
    },
    findBlock(block: number): Promise<BlockInfo> {
      if (block in blocks) {
        return Promise.resolve({
          block,
          timestamp: blocks[block],
        })
      }
      throw Error(`Block ${block} could not be retrieved.`)
    },
  }
  return blockRepository
}

export function buildSubGraphs(subGraphs?: Partial<SubGraphs>): SubGraphs {
  const metrics = createTestMetricsComponent(metricsDefinitions)
  const logs = buildLogger()
  return {
    L1: {
      checker: createMockL1Checker(),
      collections: createMockSubgraphComponent(),
    },
    L2: {
      checker: createMockL2Checker(),
      collections: createMockSubgraphComponent(),
    },
    l1BlockSearch: createAvlBlockSearch({
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
        11: 110,
      }),
    }),
    l2BlockSearch: createAvlBlockSearch({
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
        11: 110,
      }),
    }),
    ...subGraphs,
  }
}

const COMMITTEE_MEMBER = '0xCOMMITEE_MEMBER'
export function buildMockedQueryGraph(collection?: Partial<ItemCollection>, _merkleRoot?: string): SubGraphs {
  return buildSubGraphs({
    L1: {
      collections: createMockSubgraphComponent(
        jest.fn().mockResolvedValueOnce({
          collections: [
            {
              creator: '',
              managers: [],
              isApproved: false,
              isCompleted: false,
              items: [
                {
                  managers: [],
                  contentHash: '',
                },
              ],
              ...collection,
            },
          ],
          accounts: [{ id: COMMITTEE_MEMBER }],
        })
      ),
      checker: createMockL1Checker(),
    },
    L2: {
      checker: createMockL2Checker(),
      collections: createMockSubgraphComponent(
        jest.fn().mockResolvedValueOnce({
          collections: [
            {
              creator: '',
              managers: [],
              isApproved: false,
              isCompleted: false,
              items: [
                {
                  managers: [],
                  contentHash: '',
                },
              ],
              ...collection,
            },
          ],
          accounts: [{ id: COMMITTEE_MEMBER }],
        })
      ),
    },
  })
}

export const fetcherWithoutAccess = () => buildMockedQueryGraph()

export const fetcherWithValidCollectionAndCreator = (address: string): SubGraphs =>
  buildMockedQueryGraph({
    creator: address.toLowerCase(),
    isCompleted: true,
    isApproved: false,
  })

const defaultEns = [
  {
    name: 'Some Name',
  },
]

const defaultEthereum = [
  {
    urn: 'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
  },
]

const defaultMatic = [
  {
    urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0',
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2',
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa4:0',
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:19',
  },
  {
    urn: 'urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:2',
  },
]

export function fetcherWithItemsOwnership(
  address: string,
  ens?: { name: string }[],
  ethereum?: { urn: string }[],
  matic?: { urn: string }[]
): SubGraphs {
  return buildSubGraphs({
    L1: {
      checker: createMockL1Checker(),
      collections: createMockSubgraphComponent(
        jest.fn().mockResolvedValue({
          items: ethereum ?? defaultEthereum,
        })
      ),
    },
    L2: {
      checker: createMockL2Checker(),
      collections: createMockSubgraphComponent(
        jest.fn().mockResolvedValue({
          items: matic ?? defaultMatic,
        })
      ),
    },
  })
}
