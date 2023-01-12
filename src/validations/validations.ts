import { EntityType } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, OK, Validation, ValidationResponse } from '../types'
import {
  ADR_158_TIMESTAMP,
  ADR_45_TIMESTAMP,
  ADR_173_TIMESTAMP,
  ADR_74_TIMESTAMP,
  ADR_75_TIMESTAMP
} from './timestamps'

export function validationGroup(...validations: Validation[]): Validation {
  return {
    async validate(
      components: ContentValidatorComponents,
      deployment: DeploymentToValidate
    ): Promise<ValidationResponse> {
      for (const validation of validations) {
        const response = await validation.validate(components, deployment)
        if (!response.ok) return response
      }
      return OK
    }
  }
}

export function conditionalValidation(
  condition: (deployment: DeploymentToValidate) => boolean | Promise<boolean>,
  validation: Validation
): Validation {
  return {
    async validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
      const conditionIsMet = await condition(deployment)
      if (conditionIsMet) {
        return validation.validate(components, deployment)
      }
      return OK
    }
  }
}

export function validationAfterADR45(validation: Validation): Validation {
  return conditionalValidation((deployment) => deployment.entity.timestamp >= ADR_45_TIMESTAMP, validation)
}

export function validationAfterADR75(validation: Validation): Validation {
  return conditionalValidation((deployment) => deployment.entity.timestamp >= ADR_75_TIMESTAMP, validation)
}

export function validationAfterADR74(validation: Validation): Validation {
  return conditionalValidation((deployment) => deployment.entity.timestamp >= ADR_74_TIMESTAMP, validation)
}

export function validationAfterADR158(validation: Validation): Validation {
  return conditionalValidation((deployment) => deployment.entity.timestamp >= ADR_158_TIMESTAMP, validation)
}

export function validationAfterADR173(validation: Validation): Validation {
  return conditionalValidation((deployment) => deployment.entity.timestamp >= ADR_173_TIMESTAMP, validation)
}

export function validationForType(entityType: EntityType, validation: Validation) {
  return conditionalValidation((deployment) => deployment.entity.type === entityType, validation)
}
