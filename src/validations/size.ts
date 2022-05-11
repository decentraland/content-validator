import { entityParameters } from 'dcl-catalyst-commons'
import { ADR_45_TIMESTAMP, calculateDeploymentSize, LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '.'
import { OK, Validation, validationFailed } from '../types'

/** Validate that the full request size is within limits
 *
 * ADR 45: After given TIMESTAMP will also include previous deployments in the validation
 * @public
 */
export const size: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const { entity } = deployment
    if (entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP) return OK

    const maxSizeInMB = entityParameters[entity.type].maxSizeInMB
    let errors: string[] = []
    if (!maxSizeInMB) {
      return validationFailed(`Type ${entity.type} is not supported yet`)
    }
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024
    let totalSize = 0
    if (entity.timestamp > ADR_45_TIMESTAMP) {
      const result = await calculateDeploymentSize(deployment, externalCalls)
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
        }. You can upload up to ${entity.pointers.length * maxSizeInBytes} bytes but you tried to upload ${totalSize}.`,
      ]
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  },
}
