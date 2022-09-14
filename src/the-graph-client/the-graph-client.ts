import { EthAddress } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { BlockInformation, ContentValidatorComponents, TheGraphClient } from '../types'
import { BlockInfo, BlockSearch } from '@dcl/block-indexer'

export type PermissionResult = {
  result: boolean
  failing?: string[]
}

/**
 * @public
 */
export const createTheGraphClient = (
  components: Pick<ContentValidatorComponents, 'logs' | 'subGraphs'>
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

    const blocks = await findBlocksForTimestamp(
      components.subGraphs.L1.blocks,
      timestamp,
      components.subGraphs.l1BlockSearch
    )
    console.log('MARIANO ownsNamesAtTimestamp blocks', blocks)

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
      components.subGraphs.L1.collections,
      components.subGraphs.l1BlockSearch
    )
    const maticItemsOwnersPromise = ownsItemsAtTimestampInBlockchain(
      ethAddress,
      matic,
      timestamp,
      components.subGraphs.L2.blocks,
      components.subGraphs.L2.collections,
      components.subGraphs.l2BlockSearch
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
    collectionsSubgraph: ISubgraphComponent,
    blockSearch: BlockSearch
  ): Promise<PermissionResult> => {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(blocksSubgraph, timestamp, blockSearch)
    console.log('MARIANO ownsItemsAtTimestampInBlockchain blocks', blocks)

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

  const findBlocksForTimestamp = async (
    subgraph: ISubgraphComponent,
    timestamp: number,
    blockSearch: BlockSearch
  ): Promise<BlockInformation> => {
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

    const blockInformation = await runQuery(query, {
      timestamp: timestampSec,
      timestamp5Min: timestamp5MinAgo
    })

    try {
      // Attempt blockSearch but carry on if anything fails
      const nachoBlockNumberAtDeployment = await blockSearch.findBlockForTimestamp(timestampSec)
      let nachoBlockNumberFiveMinBeforeDeployment = (await blockSearch.findBlockForTimestamp(timestamp5MinAgo))!
      console.log('MARIANO', nachoBlockNumberAtDeployment, nachoBlockNumberFiveMinBeforeDeployment)
      if (nachoBlockNumberFiveMinBeforeDeployment.timestamp < timestamp5MinAgo) {
        // Mimic the way TheGraph was calculating this
        nachoBlockNumberFiveMinBeforeDeployment = {
          ...nachoBlockNumberFiveMinBeforeDeployment,
          block: nachoBlockNumberFiveMinBeforeDeployment.block + 1
        }
      }
      const nachos = {
        blockNumberAtDeployment: nachoBlockNumberAtDeployment,
        blockNumberFiveMinBeforeDeployment: nachoBlockNumberFiveMinBeforeDeployment
      }

      logIfDifferent(nachos, blockInformation, timestampSec, timestamp5MinAgo)
    } catch (e) {
      console.log(e)
    }
    return blockInformation
  }

  function logIfDifferent(
    onChainSearch: {
      blockNumberAtDeployment: BlockInfo | undefined
      blockNumberFiveMinBeforeDeployment: BlockInfo | undefined
    },
    blockInformation: BlockInformation,
    timestampSec: number,
    timestamp5MinAgo: number
  ) {
    if (
      onChainSearch.blockNumberAtDeployment?.block === blockInformation.blockNumberAtDeployment &&
      onChainSearch.blockNumberFiveMinBeforeDeployment?.block === blockInformation.blockNumberFiveMinBeforeDeployment
    ) {
      // console.log(`MARIANO: para ${timestampSec}/${timestamp5MinAgo} 0 differences`, {
      //   nachos: onChainSearch,
      //   blockInformation
      // })
    } else if (
      onChainSearch.blockNumberAtDeployment?.block !== blockInformation.blockNumberAtDeployment &&
      onChainSearch.blockNumberFiveMinBeforeDeployment?.block !== blockInformation.blockNumberFiveMinBeforeDeployment
    ) {
      console.log(`MARIANO para ${timestampSec}/${timestamp5MinAgo} 2 differences`, {
        nachos: onChainSearch,
        blockInformation
      })
    } else {
      console.log(`MARIANO para ${timestampSec}/${timestamp5MinAgo} 1 difference`, {
        nachos: onChainSearch,
        blockInformation
      })
    }
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
    orderDirection: asc
  ) {
    number
  }
  max: blocks(
    where: {timestamp_gte: $timestamp5Min, timestamp_lte: $timestamp}
    first: 1
    orderBy: timestamp
    orderDirection: desc
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
