import { EntityType } from "@dcl/schemas"
import { ADR_74_TIMESTAMP } from "."
import { ContentValidatorComponents, DeploymentToValidate, OK, Validation, validationFailed } from "../types"
import { validationForType } from './validations'

const wasCreatedAfterADR74: Validation = {
  validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
    return deployment.entity.timestamp < ADR_74_TIMESTAMP
      ? validationFailed(`The emote timestamp ${deployment.entity.timestamp} is before ADR 74. Emotes did not exist before ADR 74.`)
      : OK
  }
}

export const emote: Validation = validationForType(EntityType.EMOTE, wasCreatedAfterADR74)
