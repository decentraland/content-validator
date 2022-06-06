import {
  ContentValidatorComponents,
  ExternalCalls,
  QueryGraph
} from '../../src/types'
import { WearableCollection } from '../../src/validations/access-checker/wearables'
import { createTheGraphClient } from '../../src'
import { IFetchComponent } from '@well-known-components/http-server'
import * as nodeFetch from 'node-fetch'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { createNftOwnershipChecker } from '../../src/the-graph-client/nft-ownership-checker'

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
  const urls = {
    collectionsSubgraph: externalCalls.subgraphs.L1.collections,
    ensSubgraph: externalCalls.subgraphs.L1.ensOwner,
    maticCollectionsSubgraph: externalCalls.subgraphs.L2.collections,
    thirdPartyRegistrySubgraph: externalCalls.subgraphs.L2.thirdPartyRegistry
  }
  const theGraphClient =
    components?.theGraphClient ??
    createTheGraphClient({ logs, externalCalls, ...components }, urls)

  const nftOwnershipChecker =
    components?.nftOwnershipChecker ??
    createNftOwnershipChecker({ logs, theGraphClient })

  return {
    externalCalls,
    logs,
    theGraphClient,
    nftOwnershipChecker
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

type Subgraphs = ExternalCalls['subgraphs']

const defaultSubgraphs: Subgraphs = {
  L1: {
    collections:
      'https://api.thegraph.com/subgraphs/name/decentraland/collections-ethereum-ropsten',
    blocks:
      'https://api.thegraph.com/subgraphs/name/decentraland/blocks-ethereum-ropsten',
    landManager:
      'https://api.thegraph.com/subgraphs/name/decentraland/land-manager-ropsten',
    ensOwner:
      'https://api.thegraph.com/subgraphs/name/decentraland/marketplace-ropsten'
  },
  L2: {
    collections:
      'https://api.thegraph.com/subgraphs/name/decentraland/collections-matic-mumbai',
    blocks:
      'https://api.thegraph.com/subgraphs/name/decentraland/blocks-matic-mumbai',
    thirdPartyRegistry:
      'https://api.thegraph.com/subgraphs/name/decentraland/tpr-matic-mumbai'
  }
}

export const buildSubgraphs = (subgraphs?: Partial<Subgraphs>): Subgraphs => ({
  ...defaultSubgraphs,
  ...subgraphs
})

export function createFetchComponent(): IFetchComponent {
  return {
    async fetch(
      url: nodeFetch.RequestInfo,
      init?: nodeFetch.RequestInit
    ): Promise<nodeFetch.Response> {
      return nodeFetch.default(url, init)
    }
  }
}

export async function realQueryGraph<T = any>(
  url: string,
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const response = await createFetchComponent().fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  const responseBody = await response.json()
  console.log(
    url,
    query,
    variables,
    'response',
    JSON.stringify(responseBody, null, 2)
  )
  if (!response.ok) {
    throw new Error(
      `Error querying graph. Reasons: ${JSON.stringify(responseBody)}`
    )
  }
  return responseBody.data as T
}

export const mockedQueryGraph = () =>
  jest.fn() as jest.MockedFunction<QueryGraph>

const COMMITTEE_MEMBER = '0xCOMMITEE_MEMBER'
export const buildMockedQueryGraph = (
  collection?: Partial<WearableCollection>,
  _merkleRoot?: string
) =>
  mockedQueryGraph().mockImplementation(async (url, _query, _variables) => {
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
    if (url.includes('block')) {
      return Promise.resolve({
        after: [{ number: 10 }],
        fiveMinAfter: [{ number: 5 }]
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
          after: [{ number: 10 }],
          fiveMinAfter: [{ number: 5 }]
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
          after: [{ number: 10 }],
          fiveMinAfter: [{ number: 5 }]
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
  matic?: { urn: string }[]
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

  return mockedQueryGraph().mockImplementation(
    async (url, _query, _variables) => {
      if (url.includes('marketplace')) {
        return Promise.resolve({
          [`P${address}`]: ens ?? defaultEns
        })
      } else if (url.includes('ethereum')) {
        return Promise.resolve({
          [`P${address}`]: ethereum ?? defaultEthereum
        })
      } else if (url.includes('matic')) {
        return Promise.resolve({
          [`P${address}`]: matic ?? defaultMatic
        })
      }
      return Promise.resolve('')
    }
  )
}
