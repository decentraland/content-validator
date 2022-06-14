import { ADR_45_TIMESTAMP, ADR_XXX_TIMESTAMP } from '.'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  Validation,
  ValidationResponse
} from '../types'

export function conditionalValidation(
  condition: (
    components: ContentValidatorComponents,
    deployment: DeploymentToValidate
  ) => boolean | Promise<boolean>,
  validation: Validation
): Validation {
  return {
    async validate(
      components: ContentValidatorComponents,
      deployment: DeploymentToValidate
    ) {
      const conditionIsMet = await condition(components, deployment)
      if (conditionIsMet) {
        return validation.validate(components, deployment)
      }
      return OK
    }
  }
}

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

export function validationAfterADR45(validation: Validation): Validation {
  return conditionalValidation(
    (components, deployment) => deployment.entity.timestamp > ADR_45_TIMESTAMP,
    validation
  )
}

export function validationAfterADRXXX(validation: Validation): Validation {
  return conditionalValidation(
    (components, deployment) => deployment.entity.timestamp > ADR_XXX_TIMESTAMP,
    validation
  )
}
