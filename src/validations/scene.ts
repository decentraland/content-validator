import { EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, Validation, validationFailed } from '../types'
import { validationAfterADR173, validationForType, validationGroup } from './validations'

function sceneHasWorldConfiguration(deployment: DeploymentToValidate): boolean {
  return deployment.entity.metadata?.worldConfiguration !== undefined
}

/**
 * Validate that given scene deployment does not contain worldConfiguration section
 * @public
 */
export const noWorldsConfiguration: Validation = validationAfterADR173({
  validate: async (components, deployment) => {
    if (sceneHasWorldConfiguration(deployment)) {
      return validationFailed('Scenes cannot have worldConfiguration section after ADR 173.')
    }
    return OK
  }
})

/**
 * Validate that given scene deployment is valid
 * @public
 */
export const scene: Validation = validationForType(EntityType.SCENE, validationGroup(noWorldsConfiguration))
