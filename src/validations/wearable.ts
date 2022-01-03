import { Wearable } from '@dcl/schemas'
import { EntityType } from 'dcl-catalyst-commons'
import sharp from 'sharp'
import { calculateDeploymentSize, validateInRow } from '.'
import { OK, Validation, validationFailed } from '../types'

/** Validate wearable files size, excluding thumbnail, is less than expected */
const size: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const entity = deployment.entity
    const maxSizeInMB = externalCalls.getMaxUploadSizePerTypeInMB(EntityType.WEARABLE)
    if (!maxSizeInMB) return validationFailed(`Type ${EntityType.WEARABLE} is not supported yet`)

    const modelSizeInMB = externalCalls.wearableSizeLimitInMB

    const metadata = entity.metadata as Wearable
    const thumbnailHash = entity.content?.find(({ file }) => file === metadata.thumbnail)?.hash
    if (!thumbnailHash) return validationFailed("Couldn't find the thumbnail hash")

    const result = await calculateDeploymentSize(deployment, externalCalls)
    if (typeof result === 'string') return validationFailed(result)
    const totalDeploymentSize = result
    const thumbnailSize = deployment.files.get(thumbnailHash)?.byteLength ?? 0
    const modelSize = totalDeploymentSize - thumbnailSize
    if (modelSize > modelSizeInMB * 1024 * 1024)
      return validationFailed(
        `The deployment is too big. The maximum allowed size for wearable model files is 2 MB. You can upload up to ${
          modelSizeInMB * 1024 * 1024
        } bytes but you tried to upload ${modelSize}.`
      )
    return OK
  },
}

/** Validate that given wearable deployment includes a thumbnail with valid format and size */
const defaultThumbnailSize = 1024
const thumbnail: Validation = {
  validate: async ({ deployment }) => {
    // read thumbnail field from metadata
    const metadata = deployment.entity.metadata as Wearable

    const hash = deployment.entity.content?.find(({ file }) => file === metadata.thumbnail)?.hash
    if (!hash) return validationFailed(`Couldn't find hash for thumbnail file with name: ${metadata.thumbnail}`)

    const errors: string[] = []
    // check size
    const thumbnailBuffer = deployment.files.get(hash)
    if (!thumbnailBuffer) return validationFailed(`Couldn't find thumbnail file with hash: ${hash}`)
    try {
      const { width, height, format } = await sharp(thumbnailBuffer).metadata()
      if (!format || format !== 'png') errors.push(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
      if (!width || !height) {
        errors.push(`Couldn't validate thumbnail size for file ${metadata.thumbnail}`)
      } else if (width !== defaultThumbnailSize || height !== defaultThumbnailSize) {
        errors.push(`Invalid thumbnail image size (width = ${width} / height = ${height})`)
      }
    } catch (e) {
      errors.push(`Couldn't parse thumbnail, please check image format.`)
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  },
}

/**
 * Validate that given wearable deployment includes the thumbnail and doesn't exceed file sizes
 * * @public
 */
export const wearable: Validation = {
  validate: async (args) => {
    if (args.deployment.entity.type !== EntityType.WEARABLE) return OK
    return validateInRow(args, size, thumbnail)
  },
}
