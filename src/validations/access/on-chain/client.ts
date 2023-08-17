import { BlockSearch } from '@dcl/block-indexer'
import { EthAddress } from '@dcl/schemas'
import { getTokenIdAndAssetUrn } from '@dcl/urn-resolver'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { BlockInformation, OnChainAccessCheckerComponents, OnChainClient } from '../../../types'
import { splitItemsURNsByNetwork } from '../../../utils'

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

    const { ethereum, matic } = await splitItemsURNsByNetwork(urnsToCheck)
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
    urnsToCheck: { urn: string; type: string }[],
    timestamp: number,
    collectionsSubgraph: ISubgraphComponent,
    blockSearch: BlockSearch
  ): Promise<PermissionResult> => {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    // Urns that need to be split into urn and tokenId
    const extendedUrns = urnsToCheck
      .filter((urn) => urn.type == 'blockchain-collection-v1-item' || urn.type == 'blockchain-collection-v2-item')
      .map((urn) => urn.urn)

    const extendedUrnsSplit = extendedUrns.map((extendedUrn) => {
      const { assetUrn, tokenId } = getTokenIdAndAssetUrn(extendedUrn)
      return { urn: assetUrn, tokenId }
    })

    // Urns that don't need to be split
    const notExtendedUrns = urnsToCheck
      .filter((urn) => urn.type != 'blockchain-collection-v1-item' && urn.type != 'blockchain-collection-v2-item')
      .map((urn) => urn.urn)

    // we should always query with shortened URNs
    const urnsToQuery = notExtendedUrns.concat(Array.from(extendedUrnsSplit).map((item) => item.urn))

    const blocks = await findBlocksForTimestamp(timestamp, blockSearch)

    const hasPermissionOnBlock = async (blockNumber: number | undefined): Promise<PermissionResult> => {
      if (!blockNumber) {
        return permissionError()
      }

      const runOwnedItemsOnBlockQuery = async (blockNumber: number) => {
        const query: Query<{ items: { urn: string; tokenId: string }[] }, Set<{ urn: string; tokenId: string }>> = {
          description: 'check for items ownership',
          subgraph: collectionsSubgraph,
          query: QUERY_ITEMS_FOR_ADDRESS_AT_BLOCK,
          mapper: (response: { items: { urn: string; tokenId: string }[] }): Set<{ urn: string; tokenId: string }> => {
            console.log({ response: JSON.stringify(response, null, 2) })
            return new Set(
              response.items.map(({ urn, tokenId }) => ({
                urn,
                tokenId
              }))
            )
          }
        }
        return runQuery(query, {
          block: blockNumber,
          ethAddress,
          urnList: urnsToQuery
        })
      }

      try {
        const ownedItems = await runOwnedItemsOnBlockQuery(blockNumber)
        const ownedItemsArray = Array.from(ownedItems)

        console.log('Client', { urnsToQuery })
        console.log('Client', { ownedItemsArray: JSON.stringify(ownedItemsArray, null, 2) })
        let notOwned = extendedUrnsSplit
          .filter(({ urn, tokenId }) => {
            return !ownedItemsArray.some((item) => item.urn === urn && item.tokenId === tokenId)
          })
          .map(({ urn, tokenId }) => `${urn}:${tokenId}`)

        notOwned = notOwned.concat(notExtendedUrns.filter((urn) => !ownedItemsArray.some((item) => item.urn === urn)))

        console.log('Client', { notOwned })
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
    console.log('Running query', { query: query.query, variables })
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
    urn,
    tokenId
  }
}`

type Query<QueryResult, ReturnType> = {
  description: string
  subgraph: ISubgraphComponent
  query: string
  mapper: (queryResult: QueryResult) => ReturnType
}
