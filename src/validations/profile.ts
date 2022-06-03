import { EntityType } from '@dcl/schemas'
import sharp from 'sharp'
import { ADR_45_TIMESTAMP, ADR_XXX_TIMESTAMP, validateInRow } from '.'
import { OK, Validation, validationFailed } from '../types'
import { parseUrn } from '@dcl/urn-resolver'

/** Validate that given profile deployment includes a face256 thumbnail with valid size */
const defaultThumbnailSize = 256

const urnWhiteList = new Set([
  'fistpump',
  'wave',
  'robot',
  'raiseHand',
  'clap',
  'money',
  'kiss',
  'hammer',
  'hohoho',
  'snowfall',
  'dance',
  'shrug',
  'tik',
  'tektonik',
  'dontsee',
  'dab',
  'handsair',
  'disco'
])

export const faceThumbnail: Validation = {
  validate: async ({ externalCalls }, deployment) => {
    if (deployment.entity.timestamp < ADR_45_TIMESTAMP) return OK

    const errors: string[] = []
    const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []

    for (const avatar of allAvatars) {
      const hash = avatar.avatar.snapshots.face256
      if (!hash)
        return validationFailed(
          `Couldn't find hash for face256 thumbnail file with name: 'face256'`
        )

      const isAlreadyStored =
        (await externalCalls.isContentStoredAlready([hash])).get(hash) ?? false
      if (isAlreadyStored) {
        return OK
      }
      // check size
      const thumbnailBuffer = deployment.files.get(hash)
      if (!thumbnailBuffer)
        return validationFailed(
          `Couldn't find thumbnail file with hash: ${hash}`
        )
      try {
        const { width, height, format } = await sharp(
          thumbnailBuffer
        ).metadata()
        if (!format || format !== 'png')
          errors.push(
            `Invalid or unknown image format. Only 'PNG' format is accepted.`
          )
        if (!width || !height) {
          errors.push(`Couldn't validate thumbnail size for file 'face256'`)
        } else if (
          width !== defaultThumbnailSize ||
          height !== defaultThumbnailSize
        ) {
          errors.push(
            `Invalid face256 thumbnail image size (width = ${width} / height = ${height})`
          )
        }
      } catch (e) {
        errors.push(
          `Couldn't parse face256 thumbnail, please check image format.`
        )
      }
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  }
}

export const wearableUrns: Validation = {
  validate: async (components, deployment) => {
    if (deployment.entity.timestamp < ADR_XXX_TIMESTAMP) return OK

    const allAvatars: any[] = deployment.entity.metadata?.avatars ?? []
    for (const avatar of allAvatars) {
      for (const pointer of avatar.avatar.wearables) {
        if (urnWhiteList.has(pointer)) {
          continue
        }
        const parsed = await parseUrn(pointer)
        if (!parsed)
          return validationFailed(
            `Wearable pointers should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${pointer})`
          )
      }
    }
    return OK
  }
}

/**
 * Validate that given profile deployment includes the face256 file with the correct size
 * * @public
 */
export const profile: Validation = {
  validate: async (components, deployment) => {
    if (deployment.entity.type !== EntityType.PROFILE) return OK

    return validateInRow(deployment, components, faceThumbnail, wearableUrns)
  }
}
