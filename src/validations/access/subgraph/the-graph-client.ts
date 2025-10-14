import { EthAddress } from '@dcl/schemas'
import { getTokenIdAndAssetUrn } from '@dcl/urn-resolver'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { BlockInformation, SubgraphAccessCheckerComponents, TheGraphClient } from '../../../types'
import { splitItemsURNsByTypeAndNetwork } from '../../../utils'

export type PermissionResult = {
  result: boolean
  failing?: string[]
}

/**
 * @public
 */
export const createTheGraphClient = (
  components: Pick<SubgraphAccessCheckerComponents, 'logs' | 'subGraphs'>
): TheGraphClient => {
  const logger = components.logs.getLogger('TheGraphClient')

  const ownsAnyNameAtTimestamp = async (ethAddress: EthAddress, timestamp: number): Promise<PermissionResult> => {
    const blocks = await findBlocksForTimestamp(components.subGraphs.L1.blocks, timestamp)

    const hasPermissionOnBlock = async (blockNumber: number | undefined): Promise<PermissionResult> => {
      if (!blockNumber) {
        return permissionError()
      }

      const runOwnedNamesOnBlockQuery = async (blockNumber: number) => {
        const query: Query<{ names: { name: string }[] }, Set<string>> = {
          description: 'check for any name ownership',
          subgraph: components.subGraphs.L1.ensOwner,
          query: QUERY_ANY_NAME_FOR_ADDRESS_AT_BLOCK,
          mapper: (response: { names: { name: string }[] }): Set<string> =>
            new Set(response.names.map(({ name }) => name))
        }
        return runQuery(query, {
          block: blockNumber,
          ethAddress
        })
      }

      try {
        const ownedName = await runOwnedNamesOnBlockQuery(blockNumber)
        return ownedName.size > 0 ? permissionOk() : permissionError()
      } catch {
        logger.error(`Error retrieving any name owned by address ${ethAddress} at block ${blockNumber}`)
        return permissionError()
      }
    }

    const permissionMostRecentBlock = await hasPermissionOnBlock(blocks.blockNumberAtDeployment)
    if (permissionMostRecentBlock.result) {
      return permissionMostRecentBlock
    }

    return await hasPermissionOnBlock(blocks.blockNumberFiveMinBeforeDeployment)
  }

  const ownsNamesAtTimestamp = async (
    ethAddress: EthAddress,
    namesToCheck: string[],
    timestamp: number
  ): Promise<PermissionResult> => {
    if (namesToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(components.subGraphs.L1.blocks, timestamp)

    const hasPermissionOnBlock = async (blockNumber: number | undefined): Promise<PermissionResult> => {
      if (!blockNumber) {
        return permissionError()
      }

      const runOwnedNamesOnBlockQuery = async (blockNumber: number) => {
        const query: Query<{ names: { name: string }[] }, Set<string>> = {
          description: 'check for names ownership',
          subgraph: components.subGraphs.L1.ensOwner,
          query: QUERY_NAMES_FOR_ADDRESS_AT_BLOCK,
          mapper: (response: { names: { name: string }[] }): Set<string> =>
            new Set(response.names.map(({ name }) => name))
        }
        return runQuery(query, {
          block: blockNumber,
          ethAddress,
          nameList: namesToCheck
        })
      }

      try {
        const ownedNames = await runOwnedNamesOnBlockQuery(blockNumber)
        const notOwned = namesToCheck.filter((name) => !ownedNames.has(name))
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

    const { ethereum, matic } = await splitItemsURNsByTypeAndNetwork(urnsToCheck)
    const ethereumItemsOwnersPromise = ownsItemsAtTimestampInBlockchain(
      ethAddress,
      ethereum,
      timestamp,
      components.subGraphs.L1.blocks,
      components.subGraphs.L1.collections
    )
    const maticItemsOwnersPromise = ownsItemsAtTimestampInBlockchain(
      ethAddress,
      matic,
      timestamp,
      components.subGraphs.L2.blocks,
      components.subGraphs.L2.collections
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
    blocksSubgraph: ISubgraphComponent,
    collectionsSubgraph: ISubgraphComponent
  ): Promise<PermissionResult> => {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const urnsToQuery = urnsToCheck.map((urn) => {
      if (urn.type === 'blockchain-collection-v1-item' || urn.type === 'blockchain-collection-v2-item') {
        // Urns that need to be split into urn and tokenId
        const { assetUrn } = getTokenIdAndAssetUrn(urn.urn)
        return assetUrn
      } else {
        return urn.urn
      }
    })

    const blocks = await findBlocksForTimestamp(blocksSubgraph, timestamp)

    const hasPermissionOnBlock = async (blockNumber: number | undefined): Promise<PermissionResult> => {
      if (!blockNumber) {
        return permissionError()
      }

      const runOwnedItemsOnBlockQuery = async (blockNumber: number) => {
        const query: Query<{ items: { urn: string; tokenId: string }[] }, Set<{ urn: string; tokenId: string }>> = {
          description: 'check for items ownership',
          subgraph: collectionsSubgraph,
          query: QUERY_ITEMS_FOR_ADDRESS_AT_BLOCK,
          mapper: (response: { items: { urn: string; tokenId: string }[] }): Set<{ urn: string; tokenId: string }> =>
            new Set(
              response.items.map(({ urn, tokenId }) => ({
                urn,
                tokenId
              }))
            )
        }
        return runQuery(query, {
          block: blockNumber,
          ethAddress: ethAddress.toLowerCase(),
          urnList: urnsToQuery
        })
      }

      try {
        const ownedItems = await runOwnedItemsOnBlockQuery(blockNumber)
        const ownedItemsArray = Array.from(ownedItems)
        const notOwned: string[] = []

        for (const urn of urnsToCheck) {
          if (urn.type === 'blockchain-collection-v1-item' || urn.type === 'blockchain-collection-v2-item') {
            const { assetUrn, tokenId } = getTokenIdAndAssetUrn(urn.urn)
            if (
              !ownedItemsArray.some(
                (item) =>
                  item.urn.toLowerCase() === assetUrn.toLowerCase() &&
                  item.tokenId.toLowerCase() === tokenId.toLowerCase()
              )
            ) {
              notOwned.push(urn.urn)
            }
          } else if (!ownedItemsArray.some((item) => item.urn === urn.urn)) {
            notOwned.push(urn.urn)
          }
        }

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

  const findBlocksForTimestamp = async (subgraph: ISubgraphComponent, timestamp: number): Promise<BlockInformation> => {
    const query: Query<
      {
        min: { number: string }[]
        max: { number: string }[]
      },
      BlockInformation
    > = {
      description: 'fetch blocks for timestamp',
      subgraph: subgraph,
      query: QUERY_BLOCKS_FOR_TIMESTAMP,
      mapper: (response) => {
        const blockNumberAtDeployment = response.max[0]?.number
        const blockNumberFiveMinBeforeDeployment = response.min[0]?.number
        if (blockNumberAtDeployment === undefined && blockNumberFiveMinBeforeDeployment === undefined) {
          throw new Error(`Failed to find blocks for the specific timestamp`)
        }

        return {
          blockNumberAtDeployment: !!blockNumberAtDeployment ? parseInt(blockNumberAtDeployment) : undefined,
          blockNumberFiveMinBeforeDeployment: !!blockNumberFiveMinBeforeDeployment
            ? parseInt(blockNumberFiveMinBeforeDeployment)
            : undefined
        }
      }
    }

    /*
     * This mimics original behavior of looking up to 8 seconds after the entity timestamp
     * and up to 5 minutes and 7 seconds before
     */
    const timestampSec = Math.ceil(timestamp / 1000) + 8
    const timestamp5MinAgo = timestampSec - 60 * 5 - 7

    return await runQuery(query, {
      timestamp: timestampSec,
      timestamp5Min: timestamp5MinAgo
    })
  }

  return {
    ownsAnyNameAtTimestamp,
    ownsNamesAtTimestamp,
    ownsItemsAtTimestamp,
    findBlocksForTimestamp
  }
}

const QUERY_BLOCKS_FOR_TIMESTAMP = `
query getBlockForTimestampRange($timestamp: Int!, $timestamp5Min: Int!) {
  min: blocks(
    where: {timestamp_gte: $timestamp5Min, timestamp_lte: $timestamp}
    first: 1
    orderBy: timestamp
    orderDirection: desc
  ) {
    number
  }
  max: blocks(
    where: {timestamp_gte: $timestamp5Min, timestamp_lte: $timestamp}
    first: 1
    orderBy: timestamp
    orderDirection: asc
  ) {
    number
  }
}`

const QUERY_NAMES_FOR_ADDRESS_AT_BLOCK = `
query getNftNamesForBlock($block: Int!, $ethAddress: Bytes!, $nameList: [String!]) {
  names: nfts(
    block: {number: $block}
    where: {owner_: {address: $ethAddress},, category: ens, name_in: $nameList}
    first: 1000
  ) {
    name
  }
}`

const QUERY_ANY_NAME_FOR_ADDRESS_AT_BLOCK = `
query getAnyNameForBlock($block: Int!, $ethAddress: Bytes!) {
  name: nfts(
    block: {number: $block}
    where: {owner_: {address: $ethAddress}, category: ens}
    first: 1
  ) {
    name
  }
}`

const QUERY_ITEMS_FOR_ADDRESS_AT_BLOCK = `
query getNftItemsForBlock($block: Int!, $ethAddress: Bytes!, $urnList: [String!]) {
  items: nfts(
    block: {number: $block}
    where: {owner_: {address: $ethAddress}, searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"] urn_in: $urnList}
    first: 1000
  ) {
    urn
    tokenId
  }
}`

type Query<QueryResult, ReturnType> = {
  description: string
  subgraph: ISubgraphComponent
  query: string
  mapper: (queryResult: QueryResult) => ReturnType
}
