import { EthAddress } from '@dcl/schemas'
import { ItemsOwnership, NamesOwnership } from '../../../src/types'

export function createItemsOwnershipWith(ownerAddress: string, ownedWearables: string[]): ItemsOwnership {
  return {
    async ownsItemsAtTimestamp(ethAddress: EthAddress, urnsToCheck: string[]) {
      const result = ethAddress === ownerAddress && urnsToCheck.every((wearable) => ownedWearables.includes(wearable))
      if (!result) {
        const failing = urnsToCheck.filter((wearable) => !ownedWearables.includes(wearable))
        return {
          result,
          failing
        }
      }
      return {
        result
      }
    }
  }
}

export function createNamesOwnershipWith(ownerAddress: string, ownedNames: string[]): NamesOwnership {
  return {
    async ownsNamesAtTimestamp(ethAddress: EthAddress, namesToCheck: string[]) {
      const result = ethAddress === ownerAddress && namesToCheck.every((name) => ownedNames.includes(name))
      if (!result) {
        const failing = namesToCheck.filter((name) => !ownedNames.includes(name))
        return {
          result,
          failing
        }
      }
      return {
        result
      }
    }
  }
}
