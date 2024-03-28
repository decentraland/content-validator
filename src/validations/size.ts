import { EntityType, Wearable, WearableCategory } from '@dcl/schemas'
import { calculateDeploymentSize } from '.'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  ValidationResponse,
  validationFailed
} from '../types'
import { entityParameters, skinMaxSizeInMb } from './ADR51'
import { ADR_45_TIMESTAMP, LEGACY_CONTENT_MIGRATION_TIMESTAMP } from './timestamps'

/** Validate that the full request size is within limits
 *
 * ADR 45: After given TIMESTAMP will also include previous deployments in the validation
 * @public
 */
export function createSizeValidateFn(components: ContentValidatorComponents): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    if (entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP) return OK

    let maxSizeInMB = entityParameters[entity.type]?.maxSizeInMB
    let errors: string[] = []
    if (!maxSizeInMB) {
      return validationFailed(`Type ${entity.type} is not supported yet`)
    }

    if (entity.type === EntityType.WEARABLE) {
      const wearable = entity.metadata as Wearable
      if (wearable.data?.category === WearableCategory.SKIN) {
        maxSizeInMB = skinMaxSizeInMb
      }
    }

    const maxSizeInBytes = maxSizeInMB * 1024 * 1024
    let totalSize = 0
    if (entity.timestamp > ADR_45_TIMESTAMP) {
      const result = await calculateDeploymentSize(deployment, components.externalCalls)
      if (typeof result === 'string') return validationFailed(result)
      totalSize = result
    } else {
      totalSize = Array.from(deployment.files.values()).reduce((acc, file) => acc + file.byteLength, 0)
    }
    const sizePerPointer = totalSize / entity.pointers.length
    if (sizePerPointer > maxSizeInBytes) {
      errors = [
        `The deployment is too big. The maximum allowed size per pointer is ${maxSizeInMB} MB for ${
          entity.type
        }. You can upload up to ${entity.pointers.length * maxSizeInBytes} bytes but you tried to upload ${totalSize}.`
      ]
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  }
}
