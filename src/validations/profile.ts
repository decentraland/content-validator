import { Avatar, EntityType } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import sharp from 'sharp'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse,
} from '../types'
import {
  validateAfterADR45,
  validateAfterADR74,
  validateAfterADR75,
  validateAll,
  validateIfTypeMatches,
} from './validations'

/** Validate that given profile deployment includes a face256 thumbnail with valid size */
const defaultThumbnailSize = 256

export const isOldEmote = (wearable: string): boolean => /^[a-z]+$/i.test(wearable)

export function createFaceThumbnailValidateFn(components: ContentValidatorComponents) {
  async function validateFn(deployment: DeploymentToValidate) {
    const errors: string[] = []
    const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []

    for (const avatar of allAvatars) {
      const hash = avatar.avatar.snapshots.face256
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
    return errors.length > 0 ? validationFailed(...errors) : OK
  }

  return validateAfterADR45(validateFn)
}

export const wearableUrnsValidateFn = validateAfterADR75(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []
  for (const avatar of allAvatars) {
    for (const pointer of avatar.avatar.wearables) {
      if (isOldEmote(pointer)) continue

      const parsed = await parseUrn(pointer)
      if (!parsed)
        return validationFailed(
          `Each profile wearable pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${pointer})`
        )
    }
  }
  return OK
})

export const emoteUrnsValidateFn = validateAfterADR74(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
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
      if (slot < 0 || slot > 9) {
        return validationFailed(`The slot ${slot} of the emote ${urn} must be a number between 0 and 9 (inclusive).`)
      }
    }
  }
  return OK
})

function profileHasEmotes(deployment: DeploymentToValidate) {
  const allAvatars: Avatar[] = deployment.entity.metadata?.avatars ?? []
  for (const avatar of allAvatars) {
    if (avatar.avatar?.emotes) {
      return true
    }
  }
  return false
}

export const profileMustHaveEmotesValidateFn = validateAfterADR74(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  if (!profileHasEmotes(deployment)) {
    return validationFailed('Profile must have emotes after ADR 74.')
  }
  return OK
})

export function createProfileValidateFn(components: ContentValidatorComponents): ValidateFn {
  /**
   * Validate that given profile deployment includes the face256 file with the correct size
   * * @public
   */
  return validateIfTypeMatches(
    EntityType.PROFILE,
    validateAll(
      createFaceThumbnailValidateFn(components),
      wearableUrnsValidateFn,
      emoteUrnsValidateFn,
      profileMustHaveEmotesValidateFn
    )
  )
}
