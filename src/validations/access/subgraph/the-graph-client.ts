import { EthAddress } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { BlockInformation, SubgraphAccessCheckerComponents, TheGraphClient } from '../../../types'

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
    urnsToCheck: string[],
    timestamp: number,
    blocksSubgraph: ISubgraphComponent,
    collectionsSubgraph: ISubgraphComponent
  ): Promise<PermissionResult> => {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(blocksSubgraph, timestamp)

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
query getNftNamesForBlock($block: Int!, $ethAddress: String!, $nameList: [String!]) {
  names: nfts(
    block: {number: $block}
    where: {owner: $ethAddress, category: ens, name_in: $nameList}
    first: 1000
  ) {
    name
  }
}`

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
