import { SubgraphAccessCheckerComponents, SubGraphs } from '../../../src'
import {
  createV1andV2collectionAssetValidateFn,
  ItemCollection
} from '../../../src/validations/subgraph-access-checker/collection-asset'
import { createTheGraphClient } from '../../../src/validations/subgraph-access-checker/the-graph-client'
import { createThirdPartyAssetValidateFn } from '../../../src/validations/subgraph-access-checker/third-party-asset'
import { buildComponents, createMockSubgraphComponent } from '../../setup/mock'

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

export const defaultBlocks = {
  min: [{ number: 123400 }],
  max: [{ number: 123500 }]
}

export const buildSubgraphAccessCheckerComponents = (
  provided?: Partial<SubgraphAccessCheckerComponents>
): SubgraphAccessCheckerComponents => {
  const basicComponents = buildComponents(provided)
  const subGraphs = provided?.subGraphs ?? buildSubGraphs()
  const theGraphClient =
    provided?.theGraphClient ?? createTheGraphClient({ logs: basicComponents.logs, subGraphs, ...provided })

  const { logs, externalCalls } = basicComponents

  const thirdPartyAssetValidateFn =
    provided?.thirdPartyAssetValidateFn ??
    createThirdPartyAssetValidateFn({ logs, externalCalls, theGraphClient, subGraphs })
  const v1andV2collectionAssetValidateFn =
    provided?.v1andV2collectionAssetValidateFn ??
    createV1andV2collectionAssetValidateFn({ logs, externalCalls, theGraphClient, subGraphs })
  return {
    ...basicComponents,
    thirdPartyAssetValidateFn,
    v1andV2collectionAssetValidateFn,
    theGraphClient,
    subGraphs
  }
}

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

export function fetcherWithThirdPartyEmptyMerkleRoots(): SubGraphs {
  return buildSubGraphs({
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
}

export function fetcherWithItemsOwnership(
  address: string,
  ens?: { name: string }[],
  ethereum?: { urn: string }[],
  matic?: { urn: string }[],
  blocks?: {
    min: { number: number }[]
    max: { number: number }[]
  }
): SubGraphs {
  return buildSubGraphs({
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
}

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

export function buildSubGraphs(subGraphs?: Partial<SubGraphs>): SubGraphs {
  return {
    ...defaultSubGraphs,
    ...subGraphs
  }
}
