import { Avatar, Entity, EthAddress } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import { OK, Validation, validationFailed } from '../../types'
import { isOldEmote } from '../profile'
import { validationAfterADR75, validationGroup } from '../validations'

export const pointerIsValid: Validation = {
  validate: async ({ externalCalls }, deployment) => {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(`Only one pointer is allowed when you create a Profile. Received: ${pointers}`)

    const pointer: string = pointers[0].toLowerCase()

    if (pointer.startsWith('default')) {
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(`Only Decentraland can add or modify default profiles`)
    } else if (!EthAddress.validate(pointer)) {
      return validationFailed(`The given pointer is not a valid ethereum address.`)
    } else if (pointer !== ethAddress.toLowerCase()) {
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )
    }
    return OK
  }
}

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export const profileOwnsWearables: Validation = validationAfterADR75({
  validate: async ({ externalCalls, theGraphClient }, deployment) => {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const names = allClaimedNames(deployment.entity)
    const namesCheckResult = await theGraphClient.checkForNamesOwnershipWithTimestamp(
      ethAddress,
      names,
      deployment.entity.timestamp
    )
    if (!namesCheckResult.result)
      return validationFailed(
        `The following names (${namesCheckResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )

    const wearableUrns = await allWearablesUrns(deployment.entity)
    const wearablesCheckResult = await theGraphClient.ownsItemsAtTimestamp(
      ethAddress,
      wearableUrns,
      deployment.entity.timestamp
    )
    if (!wearablesCheckResult.result) {
      return validationFailed(
        `The following wearables (${wearablesCheckResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )
    }

    return OK
  }
})

const allClaimedNames = (entity: Entity): string[] =>
  entity.metadata.avatars
    .filter((avatar: Avatar) => avatar.hasClaimedName)
    .map((avatar: Avatar) => avatar.name)
    .filter((name: string) => name && name.trim().length > 0)

const isBaseAvatar = (wearable: string): boolean => wearable.includes('base-avatars')

const translateWearablesIdFormat = async (wearableId: string): Promise<string | undefined> => {
  if (!wearableId.startsWith('dcl://')) {
    return wearableId
  }
  const parsed = await parseUrn(wearableId)
  return parsed?.uri?.toString()
}

const allWearablesUrns = async (entity: Entity) => {
  const allWearablesInProfilePromises: Promise<string | undefined>[] = []
  for (const avatar of entity.metadata.avatars) {
    for (const wearableId of avatar.avatar.wearables) {
      if (!isBaseAvatar(wearableId) && !isOldEmote(wearableId)) {
        allWearablesInProfilePromises.push(translateWearablesIdFormat(wearableId))
      }
    }
  }

  return (await Promise.all(allWearablesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
}

export const profiles: Validation = validationGroup(pointerIsValid, profileOwnsWearables)
