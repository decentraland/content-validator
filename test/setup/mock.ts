import { createConfigComponent } from '@well-known-components/env-config-provider'
import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { createTheGraphClient } from '../../src'
import { ContentValidatorComponents, ExternalCalls, QueryGraph, SubGraphs } from '../../src/types'
import { ItemCollection } from '../../src/validations/access-checker/items/collection-asset'

export const buildLogger = (): ILoggerComponent => ({
  getLogger: () => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    log() {}
  })
})

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
    subGraphs
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
  ...externalCalls
})

export const createMockSubgraphComponent = (mock?: QueryGraph): ISubgraphComponent => ({
  query: mock ?? (jest.fn() as jest.MockedFunction<QueryGraph>)
})

const defaultSubGraphs: SubGraphs = {
  L1: {
    collections: createMockSubgraphComponent(),
    blocks: createMockSubgraphComponent(),
    landManager: createMockSubgraphComponent(),
    ensOwner: createMockSubgraphComponent()
  },
  L2: {
    collections: createMockSubgraphComponent(),
    blocks: createMockSubgraphComponent(),
    thirdPartyRegistry: createMockSubgraphComponent()
  }
}

export const buildSubGraphs = (subGraphs?: Partial<SubGraphs>): SubGraphs => ({
  ...defaultSubGraphs,
  ...subGraphs
})

const COMMITTEE_MEMBER = '0xCOMMITEE_MEMBER'
export const buildMockedQueryGraph = (collection?: Partial<ItemCollection>, _merkleRoot?: string): SubGraphs =>
  buildSubGraphs({
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
                  contentHash: ''
                }
              ],
              ...collection
            }
          ],
          accounts: [{ id: COMMITTEE_MEMBER }]
        })
      ),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValueOnce(defaultBlocks)),
      landManager: createMockSubgraphComponent(),
      ensOwner: createMockSubgraphComponent()
    },
    L2: {
      thirdPartyRegistry: createMockSubgraphComponent(),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValueOnce(defaultBlocks)),
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
                  contentHash: ''
                }
              ],
              ...collection
            }
          ],
          accounts: [{ id: COMMITTEE_MEMBER }]
        })
      )
    }
  })

export const fetcherWithoutAccess = () => buildMockedQueryGraph()

export const fetcherWithValidCollectionAndCreator = (address: string): SubGraphs =>
  buildMockedQueryGraph({
    creator: address.toLowerCase(),
    isCompleted: true,
    isApproved: false
  })

export const fetcherWithThirdPartyMerkleRoot = (root: string): SubGraphs =>
  buildSubGraphs({
    L1: {
      collections: createMockSubgraphComponent(),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValueOnce(defaultBlocks)),
      landManager: createMockSubgraphComponent(),
      ensOwner: createMockSubgraphComponent()
    },
    L2: {
      thirdPartyRegistry: createMockSubgraphComponent(
        jest.fn().mockResolvedValueOnce({
          thirdParties: [
            {
              root
            }
          ]
        })
      ),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValueOnce(defaultBlocks)),
      collections: createMockSubgraphComponent()
    }
  })

export const fetcherWithThirdPartyEmptyMerkleRoots = (): SubGraphs =>
  buildSubGraphs({
    L1: {
      collections: createMockSubgraphComponent(),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValueOnce(defaultBlocks)),
      landManager: createMockSubgraphComponent(),
      ensOwner: createMockSubgraphComponent()
    },
    L2: {
      thirdPartyRegistry: createMockSubgraphComponent(
        jest.fn().mockResolvedValueOnce({
          thirdParties: []
        })
      ),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValueOnce(defaultBlocks)),
      collections: createMockSubgraphComponent()
    }
  })

const defaultEns = [
  {
    name: 'Some Name'
  }
]

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

const defaultBlocks = {
  min: [{ number: 123400 }],
  max: [{ number: 123500 }]
}

export const fetcherWithItemsOwnership = (
  address: string,
  ens?: { name: string }[],
  ethereum?: { urn: string }[],
  matic?: { urn: string }[],
  blocks?: {
    min: { number: number }[]
    max: { number: number }[]
  }
): SubGraphs =>
  buildSubGraphs({
    L1: {
      collections: createMockSubgraphComponent(
        jest.fn().mockResolvedValue({
          items: ethereum ?? defaultEthereum
        })
      ),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValue(blocks ?? defaultBlocks)),
      landManager: createMockSubgraphComponent(),
      ensOwner: createMockSubgraphComponent(
        jest.fn().mockResolvedValue({
          names: ens ?? defaultEns
        })
      )
    },
    L2: {
      thirdPartyRegistry: createMockSubgraphComponent(
        jest.fn().mockResolvedValue({
          thirdParties: []
        })
      ),
      blocks: createMockSubgraphComponent(jest.fn().mockResolvedValue(blocks ?? defaultBlocks)),
      collections: createMockSubgraphComponent(
        jest.fn().mockResolvedValue({
          items: matic ?? defaultMatic
        })
      )
    }
  })
