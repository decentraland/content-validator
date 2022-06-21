import { IPFSv2 } from '@dcl/schemas'
import { ContentValidatorComponents } from '..'
import { fromErrors, Validation } from '../types'
import { validationAfterADR45 } from './validations'

/**
 * Validate that all hashes used by the entity were actually IPFS hashes
 * @public
 */
export const ipfsHashing: Validation = validationAfterADR45({
  validate: (components: ContentValidatorComponents, deployment) => {
    const { entity } = deployment

    const hashesInContent = entity.content?.map(({ hash }) => hash) ?? []
    const allHashes = [entity.id, ...hashesInContent]

    const errors = allHashes
      .filter((hash) => !IPFSv2.validate(hash))
      .map((hash) => `This hash '${hash}' is not valid. It should be IPFS v2 format.`)

    return fromErrors(...errors)
  }
})
