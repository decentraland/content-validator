import { EthAddress } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { BlockInformation, OnChainAccessCheckerComponents, OnChainClient } from '../../types'
import { BlockSearch } from '@dcl/block-indexer'

export type PermissionResult = {
  result: boolean
  failing?: string[]
}

export function timestampBounds(timestampMs: number) {
  /*
   * This mimics original behavior of looking up to 8 seconds after the entity timestamp
   * and up to 5 minutes and 7 seconds before
   */
  const timestampSec = Math.ceil(timestampMs / 1000) + 8
  const timestamp5MinAgo = Math.max(timestampSec - 60 * 5 - 7, 0)

  return {
    upper: timestampSec,
    lower: timestamp5MinAgo
  }
}

/**
 * @public
 */
export const createOnChainClient = (
  components: Pick<OnChainAccessCheckerComponents, 'logs' | 'L1' | 'L2'>
): OnChainClient => {
  const logger = components.logs.getLogger('TheGraphClient')

  const L1_NETWORKS = ['mainnet', 'kovan', 'rinkeby', 'goerli']
  const L2_NETWORKS = ['matic', 'mumbai']

  const ownsNamesAtTimestamp = async (
    ethAddress: EthAddress,
    namesToCheck: string[],
    timestamp: number
  ): Promise<PermissionResult> => {
    if (namesToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(timestamp, components.L1.blockSearch)
    const hasPermissionOnBlock = async (blockNumber: number | undefined): Promise<PermissionResult> => {
      if (!blockNumber) {
        return permissionError()
      }

      try {
        const result = await components.L1.checker.checkNames(ethAddress, namesToCheck, blockNumber)
        const notOwned: string[] = []

        for (let i = 0; i < namesToCheck.length; i++) {
          if (!result[i]) {
            notOwned.push(namesToCheck[i])
          }
        }
        return notOwned.length > 0 ? permissionError(notOwned) : permissionOk()
      } catch {
        logger.error(`Error retrieving names owned by address ${ethAddress} at block ${blockNumber}`)
        return permissionError()
      }
    }

    const permissionMostRecentBlock = await hasPermissionOnBlock(blocks.blockNumberAtDeployment)
    if (permissionMostRecentBlock.result) {
      return permissionMostRecentBlock
    }

    return await hasPermissionOnBlock(blocks.blockNumberFiveMinBeforeDeployment)
  }

  type URNsByNetwork = {
    ethereum: string[]
    matic: string[]
  }

  const splitItemsByNetwork = async (urnsToCheck: string[]): Promise<URNsByNetwork> => {
    const ethereum: string[] = []
    const matic: string[] = []
    for (const urn of urnsToCheck) {
      const parsed = await parseUrn(urn)
      if (
        parsed &&
        'network' in parsed &&
        ['blockchain-collection-v1-asset', 'blockchain-collection-v2-asset'].includes(parsed.type)
      ) {
        if (L1_NETWORKS.includes(parsed.network)) {
          ethereum.push(urn)
        } else if (L2_NETWORKS.includes(parsed.network)) {
          matic.push(urn)
        }
      }
    }
    return {
      ethereum,
      matic
    }
  }

  const permissionOk = (): PermissionResult => ({ result: true })
  const permissionError = (failing?: string[]): PermissionResult => ({
    result: false,
    failing: failing
  })

  const ownsItemsAtTimestamp = async (
    ethAddress: EthAddress,
    urnsToCheck: string[],
    timestamp: number
  ): Promise<PermissionResult> => {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const { ethereum, matic } = await splitItemsByNetwork(urnsToCheck)
    const ethereumItemsOwnersPromise = ownsItemsAtTimestampInBlockchain(
      ethAddress,
      ethereum,
      timestamp,
      components.L1.collections,
      components.L1.blockSearch
    )
    const maticItemsOwnersPromise = ownsItemsAtTimestampInBlockchain(
      ethAddress,
      matic,
      timestamp,
      components.L2.collections,
      components.L2.blockSearch
    )

    const [ethereumItemsOwnership, maticItemsOwnership] = await Promise.all([
      ethereumItemsOwnersPromise,
      maticItemsOwnersPromise
    ])

    if (ethereumItemsOwnership.result && maticItemsOwnership.result) return permissionOk()
    else {
      return permissionError([...(ethereumItemsOwnership.failing ?? []), ...(maticItemsOwnership.failing ?? [])])
    }
  }

  const ownsItemsAtTimestampInBlockchain = async (
    ethAddress: EthAddress,
    urnsToCheck: string[],
    timestamp: number,
    collectionsSubgraph: ISubgraphComponent,
    blockSearch: BlockSearch
  ): Promise<PermissionResult> => {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(timestamp, blockSearch)

    const hasPermissionOnBlock = async (blockNumber: number | undefined): Promise<PermissionResult> => {
      if (!blockNumber) {
        return permissionError()
      }

      const runOwnedItemsOnBlockQuery = async (blockNumber: number) => {
        const query: Query<{ items: { urn: string }[] }, Set<string>> = {
          description: 'check for items ownership',
          subgraph: collectionsSubgraph,
          query: QUERY_ITEMS_FOR_ADDRESS_AT_BLOCK,
          mapper: (response: { items: { urn: string }[] }): Set<string> => new Set(response.items.map(({ urn }) => urn))
        }
        return runQuery(query, {
          block: blockNumber,
          ethAddress,
          urnList: urnsToCheck
        })
      }

      try {
        const ownedItems = await runOwnedItemsOnBlockQuery(blockNumber)
        const notOwned = urnsToCheck.filter((name) => !ownedItems.has(name))
        return notOwned.length > 0 ? permissionError(notOwned) : permissionOk()
      } catch (error) {
        logger.error(`Error retrieving items owned by address ${ethAddress} at block ${blocks.blockNumberAtDeployment}`)
        return permissionError()
      }
    }

    const permissionMostRecentBlock = await hasPermissionOnBlock(blocks.blockNumberAtDeployment)
    if (permissionMostRecentBlock.result) {
      return permissionMostRecentBlock
    }

    return await hasPermissionOnBlock(blocks.blockNumberFiveMinBeforeDeployment)
  }

  const runQuery = async <QueryResult, ReturnType>(
    query: Query<QueryResult, ReturnType>,
    variables: Record<string, any>
  ): Promise<ReturnType> => {
    const response = await query.subgraph.query<QueryResult>(query.query, variables)
    return query.mapper(response)
  }

  const findBlocksForTimestamp = async (timestamp: number, blockSearch: BlockSearch): Promise<BlockInformation> => {
    const { lower, upper } = timestampBounds(timestamp)

    const result = await Promise.all([
      blockSearch.findBlockForTimestamp(upper),
      blockSearch.findBlockForTimestamp(lower)
    ])

    const blockNumberAtDeployment = result[0]
    let blockNumberFiveMinBeforeDeployment = result[1]

    if (blockNumberFiveMinBeforeDeployment && blockNumberFiveMinBeforeDeployment.timestamp < lower) {
      // Mimic the way TheGraph was calculating this
      blockNumberFiveMinBeforeDeployment = {
        ...blockNumberFiveMinBeforeDeployment,
        block: blockNumberFiveMinBeforeDeployment.block + 1
      }
    }

    return {
      blockNumberAtDeployment: blockNumberAtDeployment?.block,
      blockNumberFiveMinBeforeDeployment: blockNumberFiveMinBeforeDeployment?.block
    }
  }

  return {
    ownsNamesAtTimestamp,
    ownsItemsAtTimestamp,
    findBlocksForTimestamp
  }
}

const QUERY_ITEMS_FOR_ADDRESS_AT_BLOCK = `
query getNftItemsForBlock($block: Int!, $ethAddress: String!, $urnList: [String!]) {
  items: nfts(
    block: {number: $block}
    where: {owner: $ethAddress, searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"] urn_in: $urnList}
    first: 1000
  ) {
    urn
  }
}`

type Query<QueryResult, ReturnType> = {
  description: string
  subgraph: ISubgraphComponent
  query: string
  mapper: (queryResult: QueryResult) => ReturnType
}
