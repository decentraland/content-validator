import {
  ContentValidatorComponents,
  ExternalCalls,
  QueryGraph
} from '../../src/types'
import { WearableCollection } from '../../src/validations/access-checker/wearables'
import { createTheGraphClient } from '../../src'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'

export const buildLogger = (): ILoggerComponent => ({
  getLogger: () => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    log() {}
  })
})

export const buildComponents = (
  components?: Partial<ContentValidatorComponents>
): ContentValidatorComponents => {
  const externalCalls = components?.externalCalls ?? buildExternalCalls()

  const logs = components?.logs ?? buildLogger()

  const theGraphClient =
    components?.theGraphClient ??
    createTheGraphClient({ logs, externalCalls, ...components })

  return {
    externalCalls,
    logs,
    theGraphClient
  }
}

export const buildExternalCalls = (
  externalCalls?: Partial<ExternalCalls>
): ExternalCalls => ({
  isContentStoredAlready: () => Promise.resolve(new Map()),
  fetchContentFileSize: () => Promise.resolve(undefined),
  validateSignature: () => Promise.resolve({ ok: true }),
  ownerAddress: () => '',
  isAddressOwnedByDecentraland: () => false,
  queryGraph: mockedQueryGraph(),
  subgraphs: buildSubgraphs(),
  ...externalCalls
})

export const mockedQueryGraph = () =>
  jest.fn() as jest.MockedFunction<QueryGraph>

type Subgraphs = ExternalCalls['subgraphs']

export const createMockSubgraphComponent = (
  mock?: QueryGraph
): ISubgraphComponent => ({
  query: mock ?? (jest.fn() as jest.MockedFunction<QueryGraph>)
})

const defaultSubgraphs: Subgraphs = {
  L1: {
    // 'https://api.thegraph.com/subgraphs/name/decentraland/collections-ethereum-ropsten'
    collections: createMockSubgraphComponent(),
    // 'https://api.thegraph.com/subgraphs/name/decentraland/blocks-ethereum-ropsten'
    blocks: createMockSubgraphComponent(),
    // 'https://api.thegraph.com/subgraphs/name/decentraland/land-manager-ropsten'
    landManager: createMockSubgraphComponent(),
    // 'https://api.thegraph.com/subgraphs/name/decentraland/marketplace-ropsten'
    ensOwner: createMockSubgraphComponent()
  },
  L2: {
    // 'https://api.thegraph.com/subgraphs/name/decentraland/collections-matic-mumbai'
    collections: createMockSubgraphComponent(),
    // 'https://api.thegraph.com/subgraphs/name/decentraland/blocks-matic-mumbai'
    blocks: createMockSubgraphComponent(),
    // 'https://api.thegraph.com/subgraphs/name/decentraland/tpr-matic-mumbai'
    thirdPartyRegistry: createMockSubgraphComponent()
  }
}

export const buildSubgraphs = (subgraphs?: Partial<Subgraphs>): Subgraphs => ({
  ...defaultSubgraphs,
  ...subgraphs
})

const COMMITTEE_MEMBER = '0xCOMMITEE_MEMBER'
export const buildMockedQueryGraph = (
  collection?: Partial<WearableCollection>,
  _merkleRoot?: string
) =>
  mockedQueryGraph().mockImplementation(async (_query, _variables) => {
    const withDefaults = {
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
    }
    if (_query.includes('block')) {
      // TODO UNDO
      return Promise.resolve({
        max: [{ number: 10 }],
        min: [{ number: 5 }]
      })
    } else {
      return Promise.resolve(withDefaults)
    }
  })

export const fetcherWithoutAccess = () => buildMockedQueryGraph()

export const fetcherWithValidCollectionAndCreator = (address: string) =>
  buildMockedQueryGraph({
    creator: address.toLowerCase(),
    isCompleted: true,
    isApproved: false
  })

export const fetcherWithValidCollectionAndCollectionManager = (
  address: string
) =>
  buildMockedQueryGraph({
    managers: [address.toLowerCase()],
    isCompleted: true,
    isApproved: false
  })

export const fetcherWithValidCollectionAndItemManager = (address: string) =>
  buildMockedQueryGraph({
    items: [{ managers: [address.toLowerCase()], contentHash: '' }],
    isCompleted: true,
    isApproved: false
  })

export const fetcherWithValidCollectionAndCreatorAndContentHash = (
  address: string,
  contentHash: string
) =>
  buildMockedQueryGraph({
    creator: address.toLowerCase(),
    isCompleted: true,
    isApproved: false,
    items: [{ managers: [], contentHash }]
  })

export const fetcherWithInvalidCollectionAndCreator = (address: string) =>
  buildMockedQueryGraph({
    creator: address.toLowerCase(),
    isCompleted: true,
    isApproved: true
  })

export const fetcherWithInvalidCollectionAndCollectionManager = (
  address: string
) =>
  buildMockedQueryGraph({
    managers: [address.toLowerCase()],
    isCompleted: true,
    isApproved: true
  })

export const fetcherWithInvalidCollectionAndItemManager = (address: string) =>
  buildMockedQueryGraph({
    items: [{ managers: [address.toLowerCase()], contentHash: '' }],
    isCompleted: true,
    isApproved: true
  })

export const fetcherWithInvalidCollectionAndContentHash = (
  contentHash: string
) =>
  buildMockedQueryGraph({
    items: [{ managers: [], contentHash }],
    isCompleted: true,
    isApproved: true
  })

export const fetcherWithThirdPartyMerkleRoot = (root: string) => {
  return mockedQueryGraph().mockImplementation(
    async (url, _query, _variables) => {
      if (url.includes('thirdParty')) {
        return Promise.resolve({
          thirdParties: [
            {
              root
            }
          ]
        })
      }
      if (url.includes('block')) {
        return Promise.resolve({
          max: [{ number: 10 }],
          min: [{ number: 5 }]
        })
      }
      return Promise.resolve('')
    }
  )
}

export const fetcherWithThirdPartyEmptyMerkleRoots = () => {
  return mockedQueryGraph().mockImplementation(
    async (url, _query, _variables) => {
      if (url.includes('thirdParty')) {
        return Promise.resolve({
          thirdParties: []
        })
      }
      if (url.includes('block')) {
        return Promise.resolve({
          max: [{ number: 10 }],
          min: [{ number: 5 }]
        })
      }
      return Promise.resolve('')
    }
  )
}

export const fetcherWithWearablesOwnership = (
  address: string,
  ens?: { name: string }[],
  ethereum?: { urn: string }[],
  matic?: { urn: string }[],
  blocks?: {
    min: { number: number }[]
    max: { number: number }[]
  }
) => {
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

  return mockedQueryGraph().mockImplementation(
    async (url, _query, _variables) => {
      if (url.includes('marketplace')) {
        return Promise.resolve({
          names: ens ?? defaultEns
        })
      } else if (url.includes('blocks')) {
        return Promise.resolve(blocks ?? defaultBlocks)
      } else if (url.includes('ethereum')) {
        return Promise.resolve({
          wearables: ethereum ?? defaultEthereum
        })
      } else if (url.includes('matic')) {
        return Promise.resolve({
          wearables: matic ?? defaultMatic
        })
      }
      return Promise.resolve('')
    }
  )
}
