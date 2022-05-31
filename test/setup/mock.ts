import { Fetcher } from 'dcl-catalyst-commons'
import { ContentValidatorComponents, ExternalCalls } from '../../src/types'
import { WearableCollection } from '../../src/validations/access-checker/wearables'
import { createTheGraphClient } from '../../src'

export const fetcher = new Fetcher({
  timeout: '30s',
  headers: {
    'User-Agent': `content-server/Unknown (+https://github.com/decentraland/catalyst)`,
    Origin: '127.0.0.1'
  },
  requestMiddleware: (request) => {
    console.log(request)
    return Promise.resolve(request)
  }
})

export const buildComponents = (
  components?: Partial<ContentValidatorComponents>
): ContentValidatorComponents => {
  const externalCalls = buildExternalCalls()
  const logs = { getLogger: () => console }
  const theGraphClient = createTheGraphClient(
    { logs },
    externalCalls.queryGraph,
    {
      collectionsSubgraph: '',
      ensSubgraph: '',
      maticCollectionsSubgraph: '',
      thirdPartyRegistrySubgraph: ''
    }
  )

  return {
    externalCalls,
    logs: logs,
    theGraphClient: theGraphClient,
    ...components
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
  queryGraph: fetcher.queryGraph,
  subgraphs: buildSubgraphs({
    L1: {
      collections:
        'https://api.thegraph.com/subgraphs/name/decentraland/collections-ethereum-ropsten',
      blocks: '',
      landManager: ''
    },
    L2: {
      collections:
        'https://api.thegraph.com/subgraphs/name/decentraland/collections-matic-mumbai',
      blocks: '',
      thirdPartyRegistry:
        'https://api.thegraph.com/subgraphs/name/decentraland/tpr-matic-mumbai',
      ensOwner:
        'https://api.thegraph.com/subgraphs/name/decentraland/marketplace-ropsten'
    }
  }),
  ...externalCalls
})

type Subgraphs = ExternalCalls['subgraphs']

const defaultSubgraphs: Subgraphs = {
  L1: {
    landManager: '',
    blocks: '',
    collections: ''
  },
  L2: {
    blocks: '',
    collections: '',
    thirdPartyRegistry: '',
    ensOwner: ''
  }
}
export const buildSubgraphs = (subgraphs?: Partial<Subgraphs>): Subgraphs => ({
  ...defaultSubgraphs,
  ...subgraphs
})

type QueryGraph = Fetcher['queryGraph']
export const mockedQueryGraph = () =>
  jest.fn() as jest.MockedFunction<QueryGraph>

const COMMITTEE_MEMBER = '0xCOMMITEE_MEMBER'
export const buildMockedQueryGraph = (
  collection?: Partial<WearableCollection>,
  merkleRoot?: string
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
