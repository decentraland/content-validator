import { entityParameters } from 'dcl-catalyst-commons'
import { ADR_45_TIMESTAMP } from '.'
import { conditionalValidation } from '../types'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
export const metadata = conditionalValidation({
  predicate: ({ deployment }) => {
    if (deployment.entity.timestamp <= ADR_45_TIMESTAMP) return true

    const { type, metadata } = deployment.entity

    return entityParameters[type].validate(metadata)
  },
  message: ({ deployment }) => `The metadata for this entity type (${deployment.entity.type}) is not valid.`,
})
