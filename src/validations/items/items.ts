import { EntityType, Wearable } from '@dcl/schemas'
import { BaseItem } from '@dcl/schemas/dist/platform/item/base-item'
import sharp from 'sharp'
import { calculateDeploymentSize } from '..'
import {
  OK,
  Validation,
  validationFailed
} from '../../types'
import { entityParameters } from '../ADR51'
import { conditionalValidation, validationAfterADR45, validationGroup } from '../validations'

/** Validate item files size, excluding thumbnail, is less than expected */
export const deploymentMaxSizeExcludingThumbnailIsNotExceeded: Validation = {
  validate: async ({ externalCalls }, deployment) => {
    const entity = deployment.entity
    const maxSizeInMB = entityParameters[entity.type]?.maxSizeInMB
    if (!maxSizeInMB)
      return validationFailed(
        `Type ${entity.type} is not supported yet`
      )

    const modelSizeInMB = maxSizeInMB - (maxThumbnailSizeInB / 1024)

    const metadata = entity.metadata as BaseItem
    const thumbnailHash = entity.content?.find(
      ({ file }) => file === metadata.thumbnail
    )?.hash
    if (!thumbnailHash)
      return validationFailed("Couldn't find the thumbnail hash")

    const totalDeploymentSizeInB = await calculateDeploymentSize(deployment, externalCalls)
    if (typeof totalDeploymentSizeInB === 'string') return validationFailed(totalDeploymentSizeInB)
    const thumbnailSize = deployment.files.get(thumbnailHash)?.byteLength ?? 0
    const modelSize = totalDeploymentSizeInB - thumbnailSize
    if (modelSize > modelSizeInMB * 1024 * 1024)
      return validationFailed(
        `The deployment is too big. The maximum allowed size for ${entity.type} model files is ${modelSizeInMB} MB. You can upload up to ${modelSizeInMB * 1024 * 1024
        } bytes but you tried to upload ${modelSize}.`
      )
    return OK
  }
}

/** Validate that given item deployment includes a thumbnail with valid format and size */
const maxThumbnailSizeInB = 1024
export const thumbnailMaxSizeIsNotExceeded: Validation = {
  validate: async ({ externalCalls, logs }, deployment) => {
    const logger = logs.getLogger(`${deployment.entity.type} validator`)
    // read thumbnail field from metadata
    const metadata = deployment.entity.metadata as Wearable

    const hash = deployment.entity.content?.find(
      ({ file }) => file === metadata.thumbnail
    )?.hash
    if (!hash)
      return validationFailed(
        `Couldn't find hash for thumbnail file with name: ${metadata.thumbnail}`
      )

    const errors: string[] = []
    // check size
    const thumbnailBuffer = deployment.files.get(hash)
    if (!thumbnailBuffer) {
      const isHashStored =
        (await externalCalls.isContentStoredAlready([hash])).get(hash) ?? false
      if (!isHashStored) {
        return validationFailed(
          `Couldn't find thumbnail file with hash: ${hash}`
        )
      }
      // otherwise, thumbnail was already uploaded and won't be validated again
      logger.debug(
        `Thumbnail file with hash: ${hash} is not in the deployment, but it is already stored`
      )
      return OK
    }
    try {
      const { width, height, format } = await sharp(thumbnailBuffer).metadata()
      if (!format || format !== 'png')
        errors.push(
          `Invalid or unknown image format. Only 'PNG' format is accepted.`
        )
      if (!width || !height) {
        errors.push(
          `Couldn't validate thumbnail size for file ${metadata.thumbnail}`
        )
      } else if (width > maxThumbnailSizeInB || height > maxThumbnailSizeInB) {
        errors.push(
          `Invalid thumbnail image size (width = ${width} / height = ${height})`
        )
      }
    } catch (e) {
      errors.push(`Couldn't parse thumbnail, please check image format.`)
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  }
}

/**
 * Validate that given item deployment includes the thumbnail and doesn't exceed file sizes
 * * @public
 */
export const items: Validation = conditionalValidation(
  (deployment) =>
    deployment.entity.type === EntityType.WEARABLE ||
    deployment.entity.type === EntityType.EMOTE,
  validationAfterADR45(validationGroup(
    thumbnailMaxSizeIsNotExceeded,
    deploymentMaxSizeExcludingThumbnailIsNotExceeded
  ))
)
