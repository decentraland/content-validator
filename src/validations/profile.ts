import { Avatar, EntityType, Profile } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import sharp from 'sharp'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  fromErrors,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../types'
import { ADR_158_TIMESTAMP, ADR_244_TIMESTAMP, ADR_45_TIMESTAMP } from './timestamps'
import {
  validateAfterADR232,
  validateAfterADR290RejectedTimestamp,
  validateAfterADR74,
  validateAfterADR75,
  validateAll,
  validateIfTypeMatches,
  validateUpToADR290OptionalityTimestamp
} from './validations'

/** Validate that given profile deployment includes a face256 thumbnail with valid size */
const defaultThumbnailSize = 256

export const isOldEmote = (wearable: string): boolean => /^[a-z]+$/i.test(wearable)

function correspondsToASnapshot(fileName: string, hash: string, metadata: Profile) {
  const fileNameWithoutExtension = fileName.replace(/.[^/.]+$/, '')

  return metadata.avatars.some((avatar: Avatar) =>
    Object.entries(avatar.avatar?.snapshots ?? {}).some((key) => key[0] === fileNameWithoutExtension && key[1] === hash)
  )
}

export function createFaceThumbnailValidateFn(components: ContentValidatorComponents) {
  async function validateFn(deployment: DeploymentToValidate) {
    const errors: string[] = []
    const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []

    for (const avatar of allAvatars) {
      const hash = avatar.avatar?.snapshots?.face256
      if (!hash) return validationFailed(`Couldn't find hash for face256 thumbnail file with name: 'face256'`)

      const isAlreadyStored = (await components.externalCalls.isContentStoredAlready([hash])).get(hash) ?? false
      if (isAlreadyStored) {
        return OK
      }
      // check size
      const thumbnailBuffer = deployment.files.get(hash)
      if (!thumbnailBuffer) return validationFailed(`Couldn't find thumbnail file with hash: ${hash}`)
      try {
        const { width, height, format } = await sharp(thumbnailBuffer).metadata()
        if (!format || format !== 'png') errors.push(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
        if (!width || !height) {
          errors.push(`Couldn't validate thumbnail size for file 'face256'`)
        } else if (width !== defaultThumbnailSize || height !== defaultThumbnailSize) {
          errors.push(`Invalid face256 thumbnail image size (width = ${width} / height = ${height})`)
        }
      } catch (e) {
        errors.push(`Couldn't parse face256 thumbnail, please check image format.`)
      }
    }
    return fromErrors(...errors)
  }

  return validateUpToADR290OptionalityTimestamp(ADR_45_TIMESTAMP, validateFn)
}

export async function wearableUrnsValidateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []
    for (const avatar of allAvatars) {
      for (const pointer of avatar.avatar.wearables) {
        if (isOldEmote(pointer)) continue

        const parsed = await parseUrn(pointer)
        if (!parsed) {
          return validationFailed(
            `Each profile wearable pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${pointer})`
          )
        }
        if (deployment.entity.timestamp >= ADR_244_TIMESTAMP) {
          if (parsed.type === 'blockchain-collection-v1-asset' || parsed.type === 'blockchain-collection-v2-asset') {
            return validationFailed(
              `Wearable pointer ${pointer} should be an item, not an asset. The URN must include the tokenId.`
            )
          }
        }
      }
    }
    return OK
  }
  return validateAfterADR75(validateFn)(deployment)
}

export async function emoteUrnsValidateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const allAvatars = deployment.entity.metadata?.avatars ?? []
    for (const avatar of allAvatars) {
      const allEmotes = avatar.avatar.emotes ?? []
      for (const { slot, urn } of allEmotes) {
        if (isOldEmote(urn)) continue
        const parsed = await parseUrn(urn)
        if (!parsed)
          return validationFailed(
            `Each profile emote pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${urn})`
          )
        if (deployment.entity.timestamp >= ADR_244_TIMESTAMP) {
          if (parsed.type === 'blockchain-collection-v1-asset' || parsed.type === 'blockchain-collection-v2-asset') {
            return validationFailed(
              `Emote pointer ${urn} should be an item, not an asset. The URN must include the tokenId.`
            )
          }
        }
        if (slot < 0 || slot > 9) {
          return validationFailed(`The slot ${slot} of the emote ${urn} must be a number between 0 and 9 (inclusive).`)
        }
      }
    }
    return OK
  }
  return validateAfterADR74(validateFn)(deployment)
}

function profileHasEmotes(deployment: DeploymentToValidate) {
  const allAvatars: Avatar[] = deployment.entity.metadata?.avatars ?? []
  for (const avatar of allAvatars) {
    if (avatar.avatar?.emotes) {
      return true
    }
  }
  return false
}

export async function profileMustHaveEmotesValidateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    if (!profileHasEmotes(deployment)) {
      return validationFailed('Profile must have emotes after ADR 74.')
    }
    return OK
  }
  return validateAfterADR74(validateFn)(deployment)
}

export async function profileSlotsAreNotRepeatedValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const allAvatars: Avatar[] = deployment.entity.metadata?.avatars ?? []
  const allEmotes: { slot: number }[] = allAvatars.flatMap((avatar) => avatar.avatar.emotes ?? [])
  const usedSlots = new Set()
  for (const { slot } of allEmotes) {
    if (usedSlots.has(slot)) {
      return validationFailed(`Emote slot ${slot} should not be repeated.`)
    }
    usedSlots.add(slot)
  }
  return OK
}

export async function profileWearablesNotRepeatedValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const allAvatars: Avatar[] = deployment.entity.metadata?.avatars ?? []
    for (const avatar of allAvatars) {
      const wearables = avatar.avatar.wearables
      if (new Set(wearables).size !== wearables.length) {
        return validationFailed('Wearables should not be repeated.')
      }
    }
    return OK
  }
  return validateAfterADR232(validateFn)(deployment)
}

export function createProfileImagesValidateFn(components: ContentValidatorComponents) {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const errors: string[] = []
    const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []

    for (const avatar of allAvatars) {
      const faceHash = avatar.avatar?.snapshots?.face256
      const bodyHash = avatar.avatar?.snapshots?.body

      if (!faceHash || !bodyHash)
        return validationFailed(`Couldn't find hash for face or body thumbnails on profile metadata`)

      const calculatedHashes = await components.externalCalls.calculateFilesHashes(deployment.files)

      // validate all hashes
      Array.from(calculatedHashes.entries()).forEach(([key, entry]) => {
        if (!(key === entry.calculatedHash)) {
          errors.push(`Mismatch of hash found for file. Expected: ${key} but got ${entry.calculatedHash}`)
        }
      })
    }

    return fromErrors(...errors)
  }

  return validateUpToADR290OptionalityTimestamp(ADR_45_TIMESTAMP, validateFn)
}

export async function profileMustNotHaveSnapshotsValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const allAvatars: Avatar[] = deployment.entity.metadata?.avatars ?? []
    for (const avatar of allAvatars) {
      if (avatar.avatar?.snapshots) {
        return validationFailed('Avatars must not have snapshots.')
      }
    }
    return OK
  }
  return validateAfterADR290RejectedTimestamp(validateFn)(deployment)
}

/**
 * Conditionally validates that all content uploaded with the profile entity belongs to a snapshot
 * before the ADR_45_TIMESTAMP or in the optional period of the ADR 290.
 * This validation is only applied to profile entities.
 * If no content is present, this validation will not produce an error.
 * @public
 */
export async function allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    for (const { file, hash } of entity.content ?? []) {
      // Validate all content files correspond to at least one avatar snapshot
      if (!entity.metadata || !entity.metadata.avatars || entity.metadata.avatars?.length === 0) {
        errors.push(`Entity is missing metadata or avatars`)
      } else if (!correspondsToASnapshot(file, hash, entity.metadata)) {
        errors.push(
          `This file is not expected: '${file}' or its hash is invalid: '${hash}'. Please, include only valid snapshot files.`
        )
      }
    }
    return fromErrors(...errors)
  }
  return validateUpToADR290OptionalityTimestamp(ADR_45_TIMESTAMP, validateFn)(deployment)
}

/**
 * Conditionally validates that all mandatory content files are present for the profile entity
 * before the ADR_158_TIMESTAMP or in the optional period of the ADR 290.
 * If no content is present, this validation will not produce an error.
 * @public
 */
export async function allMandatoryContentFilesArePresentValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    const fileNames = entity.content.map((a) => a.file.toLowerCase())
    if (!fileNames.includes('body.png')) {
      errors.push(`Profile entity is missing file 'body.png'`)
    }
    if (!fileNames.includes('face256.png')) {
      errors.push(`Profile entity is missing file 'face256.png'`)
    }
    return fromErrors(...errors)
  }
  return validateUpToADR290OptionalityTimestamp(ADR_158_TIMESTAMP, validateFn)(deployment)
}

/**
 * Conditionally validates that the profile entity should not have content files after the rejected ADR 290 timestamp.
 * This validation is only applied to profile entities.
 * @public
 */
export async function entityShouldNotHaveContentFilesValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    if (entity.content.length > 0) {
      errors.push(`Entity has content files when it should not: ${entity.content.map((a) => a.file).join(', ')}`)
    }
    if (deployment.files.size > 0) {
      errors.push(`Entity has uploaded files when it should not: ${Array.from(deployment.files.keys()).join(', ')}`)
    }
    return fromErrors(...errors)
  }

  return validateAfterADR290RejectedTimestamp(validateFn)(deployment)
}

export function createProfileValidateFn(components: ContentValidatorComponents): ValidateFn {
  /**
   * Validate that given profile deployment includes the face256 file with the correct size
   * * @public
   */
  return validateIfTypeMatches(
    EntityType.PROFILE,
    validateAll(
      profileMustNotHaveSnapshotsValidateFn,
      createFaceThumbnailValidateFn(components),
      createProfileImagesValidateFn(components),
      wearableUrnsValidateFn,
      emoteUrnsValidateFn,
      profileMustHaveEmotesValidateFn,
      profileSlotsAreNotRepeatedValidateFn,
      profileWearablesNotRepeatedValidateFn,
      allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn,
      allMandatoryContentFilesArePresentValidateFn,
      entityShouldNotHaveContentFilesValidateFn
    )
  )
}
