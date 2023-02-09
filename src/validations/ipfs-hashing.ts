import { IPFSv2 } from '@dcl/schemas'
import { ContentValidatorComponents } from '..'
import { DeploymentToValidate, fromErrors, ValidateFn } from '../types'
import { validateAfterADR45 } from './validations'

/**
 * Validate that all hashes used by the entity were actually IPFS hashes
 * @public
 */
export const ipfsHashing: ValidateFn = validateAfterADR45(
  (components: ContentValidatorComponents, deployment: DeploymentToValidate) => {
    const { entity } = deployment

    const hashesInContent = entity.content?.map(({ hash }) => hash) ?? []
    const allHashes = [entity.id, ...hashesInContent]

    const errors = allHashes
      .filter((hash) => !IPFSv2.validate(hash))
      .map((hash) => `This hash '${hash}' is not valid. It should be IPFS v2 format.`)

    return fromErrors(...errors)
  }
)
