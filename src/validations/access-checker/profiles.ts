import { Avatar, Entity, EthAddress } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import { ContentValidatorComponents, DeploymentToValidate, OK, ValidateFn, validationFailed } from '../../types'
import { isOldEmote } from '../profile'
import { ADR_74_TIMESTAMP, ADR_75_TIMESTAMP } from '../timestamps'
import { validateAll } from '../validations'

export async function pointerIsValid(
  components: Pick<ContentValidatorComponents, 'externalCalls'>,
  deployment: DeploymentToValidate
) {
  const pointers = deployment.entity.pointers
  const ethAddress = components.externalCalls.ownerAddress(deployment.auditInfo)

  if (pointers.length !== 1)
    return validationFailed(`Only one pointer is allowed when you create a Profile. Received: ${pointers}`)

  const pointer: string = pointers[0].toLowerCase()

  if (pointer.startsWith('default')) {
    if (!components.externalCalls.isAddressOwnedByDecentraland(ethAddress))
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

function allClaimedNames(entity: Entity): string[] {
  const allAvatars = entity.metadata?.avatars ?? []
  return allAvatars
    .filter((avatar: Avatar) => avatar.hasClaimedName)
    .map((avatar: Avatar) => avatar.name)
    .filter((name: string) => name && name.trim().length > 0)
}

export async function ownsNames(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'theGraphClient'>,
  deployment: DeploymentToValidate
) {
  const { externalCalls, theGraphClient } = components
  const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
  const names = allClaimedNames(deployment.entity)
  const namesCheckResult = await theGraphClient.ownsNamesAtTimestamp(ethAddress, names, deployment.entity.timestamp)
  if (!namesCheckResult.result)
    return validationFailed(
      `The following names (${namesCheckResult.failing?.join(
        ', '
      )}) are not owned by the address ${ethAddress.toLowerCase()}).`
    )
  return OK
}

function isBaseAvatar(urn: string): boolean {
  return urn.includes('base-avatars')
}

async function sanitizeUrn(urn: string): Promise<string | undefined> {
  if (!urn.startsWith('dcl://')) {
    return urn
  }
  const parsed = await parseUrn(urn)
  return parsed?.uri?.toString()
}

async function allOnChainWearableUrns(entity: Entity) {
  const allWearablesInProfilePromises: Promise<string | undefined>[] = []
  const allAvatars = entity.metadata?.avatars ?? []
  for (const avatar of allAvatars) {
    for (const wearableId of avatar.avatar.wearables) {
      if (!isBaseAvatar(wearableId) && !isOldEmote(wearableId)) {
        allWearablesInProfilePromises.push(sanitizeUrn(wearableId))
      }
    }
  }

  return (await Promise.all(allWearablesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
}

async function allEmoteUrns(entity: Entity) {
  const allEmotesInProfilePromises: Promise<string | undefined>[] = []
  const allAvatars = entity.metadata?.avatars ?? []
  for (const avatar of allAvatars) {
    const allEmotes = avatar.avatar.emotes ?? []
    for (const { urn } of allEmotes) {
      if (!isOldEmote(urn)) {
        allEmotesInProfilePromises.push(sanitizeUrn(urn))
      }
    }
  }

  return (await Promise.all(allEmotesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
}

export async function ownsItems(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'theGraphClient'>,
  deployment: DeploymentToValidate
) {
  const { externalCalls, theGraphClient } = components
  const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
  const depoymentTimestamp = deployment.entity.timestamp
  const itemUrns: string[] = []
  if (depoymentTimestamp >= ADR_75_TIMESTAMP) {
    for (const urn of await allOnChainWearableUrns(deployment.entity)) {
      itemUrns.push(urn)
    }
  }
  if (depoymentTimestamp >= ADR_74_TIMESTAMP) {
    for (const urn of await allEmoteUrns(deployment.entity)) {
      itemUrns.push(urn)
    }
  }
  const itemsOwnershipResult = await theGraphClient.ownsItemsAtTimestamp(
    ethAddress,
    itemUrns,
    deployment.entity.timestamp
  )
  if (!itemsOwnershipResult.result) {
    return validationFailed(
      `The following items (${itemsOwnershipResult.failing?.join(
        ', '
      )}) are not owned by the address ${ethAddress.toLowerCase()}).`
    )
  }

  return OK
}

export async function profileSlotsAreNotRepeated(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient'>,
  deployment: DeploymentToValidate
) {
  const allAvatars: Avatar[] = deployment.entity.metadata?.avatars ?? []
  const allEmotes: { slot: number }[] = allAvatars.flatMap((avatar) => avatar.avatar.emotes ?? [])
  const usedSlots = new Set()
  for (const { slot } of allEmotes) {
    if (usedSlots.has(slot)) {
      return validationFailed('Emote slots should not be repeated.')
    }
    usedSlots.add(slot)
  }
  return OK
}

export const profiles: ValidateFn = validateAll(pointerIsValid, ownsNames, ownsItems, profileSlotsAreNotRepeated)
