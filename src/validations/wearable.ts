import { EntityType, Wearable } from '@dcl/schemas'
import { entityParameters } from './ADR51'
import sharp from 'sharp'
import { ADR_45_TIMESTAMP, calculateDeploymentSize, validateInRow } from '.'
import { ContentValidatorComponents, OK, Validation, validationFailed } from '../types'

const wearableSizeLimitInMB = 2

/** Validate wearable representations are referencing valid content */
export const wearableRepresentationContent: Validation = {
  validate: async (components: ContentValidatorComponents, deployment) => {
    const { entity } = deployment
    const wearableMetadata = entity.metadata as Wearable
    const representations = wearableMetadata?.data?.representations
    if (!representations) return validationFailed('No wearable representations found')
    if (!entity.content) return validationFailed('No content found')

    for (const representation of representations) {
      for (const representationContent of representation.contents) {
        if (!entity.content.find((content) => content.file === representationContent)) {
          return validationFailed(`Representation content: '${representationContent}' is not one of the content files`)
        }
      }
    }
    return OK
  }
}

/** Validate wearable files size, excluding thumbnail, is less than expected */
export const wearableSize: Validation = {
  validate: async ({ externalCalls }, deployment) => {
    const entity = deployment.entity
    if (entity.timestamp < ADR_45_TIMESTAMP) return OK
    const maxSizeInMB = entityParameters[EntityType.WEARABLE]?.maxSizeInMB
    if (!maxSizeInMB) return validationFailed(`Type ${EntityType.WEARABLE} is not supported yet`)

    const modelSizeInMB = wearableSizeLimitInMB

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
        `The deployment is too big. The maximum allowed size for wearable model files is ${modelSizeInMB} MB. You can upload up to ${
          modelSizeInMB * 1024 * 1024
        } bytes but you tried to upload ${modelSize}.`
      )
    return OK
  }
}

/** Validate that given wearable deployment includes a thumbnail with valid format and size */
const maxThumbnailSize = 1024
export const wearableThumbnail: Validation = {
  validate: async ({ externalCalls, logs }, deployment) => {
    const logger = logs.getLogger('wearable validator')

    if (deployment.entity.timestamp < ADR_45_TIMESTAMP) return OK
    // read thumbnail field from metadata
    const metadata = deployment.entity.metadata as Wearable

    const hash = deployment.entity.content?.find(({ file }) => file === metadata.thumbnail)?.hash
    if (!hash) return validationFailed(`Couldn't find hash for thumbnail file with name: ${metadata.thumbnail}`)

    const errors: string[] = []
    // check size
    const thumbnailBuffer = deployment.files.get(hash)
    if (!thumbnailBuffer) {
      const isHashStored = (await externalCalls.isContentStoredAlready([hash])).get(hash) ?? false
      if (!isHashStored) {
        return validationFailed(`Couldn't find thumbnail file with hash: ${hash}`)
      }
      // otherwise, thumbnail was already uploaded and won't be validated again
      logger.debug(`Thumbnail file with hash: ${hash} is not in the deployment, but it is already stored`)
      return OK
    }
    try {
      const { width, height, format } = await sharp(thumbnailBuffer).metadata()
      if (!format || format !== 'png') errors.push(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
      if (!width || !height) {
        errors.push(`Couldn't validate thumbnail size for file ${metadata.thumbnail}`)
      } else if (width > maxThumbnailSize || height > maxThumbnailSize) {
        errors.push(`Invalid thumbnail image size (width = ${width} / height = ${height})`)
      }
    } catch (e) {
      errors.push(`Couldn't parse thumbnail, please check image format.`)
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  }
}

/**
 * Validate that given wearable deployment includes the thumbnail and doesn't exceed file sizes
 * * @public
 */
export const wearable: Validation = {
  validate: async (components, deployment) => {
    if (deployment.entity.type !== EntityType.WEARABLE) return OK
    return validateInRow(components, deployment, wearableRepresentationContent, wearableThumbnail, wearableSize)
  }
}
