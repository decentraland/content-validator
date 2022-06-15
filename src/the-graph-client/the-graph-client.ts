import { EthAddress, WearableId } from '@dcl/schemas'
import { ContentValidatorComponents, TheGraphClient, URLs } from '../types'
import { parseUrn } from '@dcl/urn-resolver'

/**
 * @public
 */
export const createTheGraphClient = (
  components: Pick<ContentValidatorComponents, 'logs' | 'externalCalls'>
): TheGraphClient => {
  const logger = components.logs.getLogger('TheGraphClient')

  const urls: URLs = {
    collectionsSubgraph: components.externalCalls.subgraphs.L1.collections,
    blocksSubgraph: components.externalCalls.subgraphs.L1.blocks,
    maticBlocksSubgraph: components.externalCalls.subgraphs.L2.blocks,
    ensSubgraph: components.externalCalls.subgraphs.L1.ensOwner,
    maticCollectionsSubgraph: components.externalCalls.subgraphs.L2.collections
  }

  const L1_NETWORKS = ['mainnet', 'ropsten', 'kovan', 'rinkeby', 'goerli']
  const L2_NETWORKS = ['matic', 'mumbai']

  const checkForNamesOwnershipWithTimestamp = async (
    ethAddress: EthAddress,
    namesToCheck: string[],
    timestamp: number
  ): Promise<Set<string>> => {
    const ownedNamesOnBlock = async (blockNumber: number) => {
      const query: Query<{ names: { name: string }[] }, Set<string>> = {
        description: 'check for names ownership',
        subgraph: 'ensSubgraph',
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

    const blocks = await findBlocksForTimestamp('blocksSubgraph', timestamp)

    try {
      if (blocks.blockNumberAtDeployment) {
        return await ownedNamesOnBlock(blocks.blockNumberAtDeployment)
      }
    } catch (error) {
      logger.error(
        `Error retrieving names owned by address ${ethAddress} at block ${blocks.blockNumberAtDeployment}`
      )
      logger.error(error as any)
    }

    try {
      if (blocks.blockNumberFiveMinBeforeDeployment) {
        return await ownedNamesOnBlock(
          blocks.blockNumberFiveMinBeforeDeployment
        )
      }
    } catch (error) {
      logger.error(
        `Error retrieving names owned by address ${ethAddress} at block ${blocks.blockNumberFiveMinBeforeDeployment}`
      )
      logger.error(error as any)
    }
    throw Error(
      `Could not query names for ${ethAddress} at blocks ${blocks.blockNumberAtDeployment} nor ${blocks.blockNumberFiveMinBeforeDeployment}`
    )
  }

  type WearablesByNetwork = {
    ethereum: WearableId[]
    matic: WearableId[]
  }

  async function splitWearablesByNetwork(
    wearableIdsToCheck: WearableId[]
  ): Promise<WearablesByNetwork> {
    const ethereum: WearableId[] = []
    const matic: WearableId[] = []
    for (const wearable of wearableIdsToCheck) {
      const parsed = await parseUrn(wearable)
      if (parsed && 'network' in parsed) {
        if (L1_NETWORKS.includes(parsed.network)) {
          ethereum.push(wearable)
        } else if (L2_NETWORKS.includes(parsed.network)) {
          matic.push(wearable)
        }
      }
    }
    return {
      ethereum,
      matic
    }
  }

  const checkForWearablesOwnershipWithTimestamp = async (
    ethAddress: EthAddress,
    wearableIdsToCheck: WearableId[],
    timestamp: number
  ): Promise<Set<string>> => {
    const { ethereum, matic } = await splitWearablesByNetwork(
      wearableIdsToCheck
    )
    const ethereumWearablesOwnersPromise = getOwnersByWearableWithTimestamp(
      ethAddress,
      ethereum,
      timestamp,
      'blocksSubgraph',
      'collectionsSubgraph'
    )
    const maticWearablesOwnersPromise = getOwnersByWearableWithTimestamp(
      ethAddress,
      matic,
      timestamp,
      'maticBlocksSubgraph',
      'maticCollectionsSubgraph'
    )

    const [ethereumWearablesOwners, maticWearablesOwners] = await Promise.all([
      ethereumWearablesOwnersPromise,
      maticWearablesOwnersPromise
    ])

    return new Set([...ethereumWearablesOwners, ...maticWearablesOwners])
  }

  const getOwnersByWearableWithTimestamp = async (
    ethAddress: EthAddress,
    wearableIdsToCheck: WearableId[],
    timestamp: number,
    blocksSubgraph: keyof URLs,
    collectionsSubgraph: keyof URLs
  ): Promise<Set<string>> => {
    const ownedWearablesOnBlock = async (blockNumber: number) => {
      const query: Query<{ wearables: { urn: string }[] }, Set<string>> = {
        description: 'check for wearables ownership',
        subgraph: collectionsSubgraph,
        query: QUERY_WEARABLES_FOR_ADDRESS_AT_BLOCK,
        mapper: (response: { wearables: { urn: string }[] }): Set<string> =>
          new Set(response.wearables.map(({ urn }) => urn))
      }
      return runQuery(query, {
        block: blockNumber,
        ethAddress,
        urnList: wearableIdsToCheck
      })
    }

    const blocks = await findBlocksForTimestamp(blocksSubgraph, timestamp)

    try {
      if (blocks.blockNumberAtDeployment) {
        return await ownedWearablesOnBlock(blocks.blockNumberAtDeployment)
      }
    } catch (error) {
      logger.error(
        `Error retrieving wearables owned by address ${ethAddress} at block ${blocks.blockNumberAtDeployment}`
      )
      logger.error(error as any)
    }

    try {
      if (blocks.blockNumberFiveMinBeforeDeployment) {
        return await ownedWearablesOnBlock(
          blocks.blockNumberFiveMinBeforeDeployment
        )
      }
    } catch (error) {
      logger.error(
        `Error retrieving wearables owned by address ${ethAddress} at block ${blocks.blockNumberFiveMinBeforeDeployment}`
      )
      logger.error(error as any)
    }
    throw Error(
      `Could not query wearables for ${ethAddress} at blocks ${blocks.blockNumberAtDeployment} nor ${blocks.blockNumberFiveMinBeforeDeployment}`
    )
  }

  const runQuery = async <QueryResult, ReturnType>(
    query: Query<QueryResult, ReturnType>,
    variables: Record<string, any>
  ): Promise<ReturnType> => {
    try {
      const response = await components.externalCalls.queryGraph<QueryResult>(
        urls[query.subgraph],
        query.query,
        variables
      )
      return query.mapper(response)
    } catch (error) {
      logger.error(
        `Failed to execute the following query to the subgraph ${
          urls[query.subgraph]
        } ${query.description}'.`,
        {
          query: query.query,
          variables: JSON.stringify(variables)
        }
      )
      logger.error(error as any)
      throw new Error('Internal server error')
    }
  }

  const findBlocksForTimestamp = async (
    subgraph: keyof URLs,
    timestamp: number
  ): Promise<{
    blockNumberAtDeployment: number | undefined
    blockNumberFiveMinBeforeDeployment: number | undefined
  }> => {
    const query: Query<
      {
        min: { number: string }[]
        max: { number: string }[]
      },
      {
        blockNumberAtDeployment: number | undefined
        blockNumberFiveMinBeforeDeployment: number | undefined
      }
    > = {
      description: 'fetch blocks for timestamp',
      subgraph: subgraph,
      query: QUERY_BLOCKS_FOR_TIMESTAMP,
      mapper: (response) => {
        const blockNumberAtDeployment = response.max[0]?.number
        const blockNumberFiveMinBeforeDeployment = response.min[0]?.number
        if (
          blockNumberAtDeployment === undefined &&
          blockNumberFiveMinBeforeDeployment === undefined
        ) {
          throw new Error(`Failed to find blocks for the specific timestamp`)
        }

        return {
          blockNumberAtDeployment: !!blockNumberAtDeployment
            ? parseInt(blockNumberAtDeployment)
            : undefined,
          blockNumberFiveMinBeforeDeployment:
            !!blockNumberFiveMinBeforeDeployment
              ? parseInt(blockNumberFiveMinBeforeDeployment)
              : undefined
        }
      }
    }

    const timestampSec = Math.ceil(timestamp / 1000)
    const timestamp5MinAgo = timestampSec - 60 * 5

    return await runQuery(query, {
      timestamp: timestampSec,
      timestamp5Min: timestamp5MinAgo
    })
  }

  return {
    checkForNamesOwnershipWithTimestamp,
    checkForWearablesOwnershipWithTimestamp,
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

const QUERY_WEARABLES_FOR_ADDRESS_AT_BLOCK = `
query getNftWearablesForBlock($block: Int!, $ethAddress: String!, $urnList: [String!]) {
  wearables: nfts(
    block: {number: $block}
    where: {owner: $ethAddress, searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"] urn_in: $urnList}
    first: 1000
  ) {
    urn
  }
}`

type Query<QueryResult, ReturnType> = {
  description: string
  subgraph: keyof URLs
  query: string
  mapper: (queryResult: QueryResult) => ReturnType
}
