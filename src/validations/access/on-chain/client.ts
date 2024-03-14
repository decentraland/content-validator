import { BlockSearch } from '@dcl/block-indexer'
import { EthAddress } from '@dcl/schemas'
import { BlockInformation, ItemChecker, OnChainAccessCheckerComponents, OnChainClient } from '../../../types'
import { splitItemsURNsByNetwork } from '../../../utils'

export type PermissionResult = {
  result: boolean
  failing?: string[]
}

function permissionOk(): PermissionResult {
  return { result: true }
}

function permissionError(failing?: string[]): PermissionResult {
  return {
    result: false,
    failing: failing
  }
}

export function timestampBounds(timestampMs: number) {
  /*
   * This mimics the original behavior of looking up to 8 seconds after the entity timestamp
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
export function createOnChainClient(
  components: Pick<OnChainAccessCheckerComponents, 'logs' | 'L1' | 'L2'>
): OnChainClient {
  const logger = components.logs.getLogger('OnChainClient')

  async function ownsNamesAtTimestamp(
    ethAddress: EthAddress,
    namesToCheck: string[],
    timestamp: number
  ): Promise<PermissionResult> {
    if (namesToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(timestamp, components.L1.blockSearch)

    async function hasPermissionOnBlock(blockNumber: number | undefined): Promise<PermissionResult> {
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

  async function ownsItemsAtTimestamp(
    ethAddress: EthAddress,
    urnsToCheck: string[],
    timestamp: number
  ): Promise<PermissionResult> {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const { ethereum, matic } = await splitItemsURNsByNetwork(urnsToCheck)

    const ignoredSet = new Set([
      ...ethereum.filter(({ type }) => type === 'blockchain-collection-v1-asset').map(({ urn }) => urn),
      ...matic.filter(({ type }) => type === 'blockchain-collection-v2-asset').map(({ urn }) => urn)
    ])
    if (ignoredSet.size > 0) {
      logger.info(`Ignoring these assets, considering them as "owned" by the address: ${[...ignoredSet]}`)
    }
    const filteredEthereum = ethereum
      .filter(({ type }) => type !== 'blockchain-collection-v1-asset')
      .map(({ urn }) => urn)
    const filteredMatic = matic.filter(({ type }) => type !== 'blockchain-collection-v2-asset').map(({ urn }) => urn)

    const [ethereumItemsOwnership, maticItemsOwnership] = await Promise.all([
      ownsItemsAtTimestampInBlockchain(
        ethAddress,
        filteredEthereum,
        timestamp,
        components.L1.collections,
        components.L1.blockSearch
      ),
      ownsItemsAtTimestampInBlockchain(
        ethAddress,
        filteredMatic,
        timestamp,
        components.L2.collections,
        components.L2.blockSearch
      )
    ])

    if (ethereumItemsOwnership.result && maticItemsOwnership.result) {
      return permissionOk()
    } else {
      return permissionError([...(ethereumItemsOwnership.failing ?? []), ...(maticItemsOwnership.failing ?? [])])
    }
  }

  async function ownsItemsAtTimestampInBlockchain(
    ethAddress: EthAddress,
    urnsToCheck: string[],
    timestamp: number,
    itemChecker: ItemChecker,
    blockSearch: BlockSearch
  ): Promise<PermissionResult> {
    if (urnsToCheck.length === 0) {
      return permissionOk()
    }

    const blocks = await findBlocksForTimestamp(timestamp, blockSearch)

    async function hasPermissionOnBlock(blockNumber: number | undefined): Promise<PermissionResult> {
      if (!blockNumber) {
        return permissionError()
      }

      try {
        logger.debug(`Checking items owned by address ${ethAddress} at block ${blockNumber}: ${urnsToCheck}`)
        const result = await itemChecker.checkItems(ethAddress, urnsToCheck, blockNumber)
        const notOwned: string[] = urnsToCheck.filter((_, i) => !result[i])

        if (notOwned.length > 0) {
          logger.info(`Not owned: ${notOwned}`)
          return permissionError(notOwned)
        } else {
          return permissionOk()
        }
      } catch (e: any) {
        logger.warn(`Error retrieving items owned by address ${ethAddress} at block ${blockNumber}: ${e.message}`)
        return permissionError()
      }
    }

    const permissionMostRecentBlock = await hasPermissionOnBlock(blocks.blockNumberAtDeployment)
    if (permissionMostRecentBlock.result) {
      return permissionMostRecentBlock
    }

    return await hasPermissionOnBlock(blocks.blockNumberFiveMinBeforeDeployment)
  }

  async function findBlocksForTimestamp(timestamp: number, blockSearch: BlockSearch): Promise<BlockInformation> {
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
