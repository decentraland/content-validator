import { OK, Validation, validationFailed } from '../types'

/**
 * Validate that entity is actually ok
 * @public
 */
export const entityStructure: Validation = {
  validate: async ({ deployment }) => {
    const { entity } = deployment
    if (new Set(entity.pointers).size != entity.pointers.length) {
      return validationFailed('There are repeated pointers in your request.')
    } else if (!entity.pointers || entity.pointers.length <= 0) {
      return validationFailed('The entity needs to be pointed by one or more pointers.')
    }
    return OK
  }
}
